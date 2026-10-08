"""End-to-end encryption: key storage and lookup, opaque uploads, and the server never reading envelopes."""

import base64
import json
import os
import uuid
from datetime import datetime, timezone

from app.models.message import Message, MessageType
from app.services import media_storage
from app.worker import MessageWorker
from tests.test_worker import FakeStreams


def b64(n=32):
    return base64.b64encode(os.urandom(n)).decode()


def keys_body(**extra):
    return {"enc_public": b64(), "sign_public": b64(), **extra}


def envelope(size=200):
    # The server treats envelopes as opaque; only the prefix matters to it
    return "e2e1:" + json.dumps({"v": 1, "c": base64.b64encode(os.urandom(size)).decode()})


async def test_first_device_sets_up_and_fresh_start_replaces(client, make_user, make_dm, events):
    a, b = await make_user(), await make_user()
    await make_dm(a, b)
    assert (await client.get("/api/v1/keys/me", headers=a.headers)).json()["data"] == {"has_keys": False}

    first = keys_body()
    r = await client.put("/api/v1/keys/me", json=first, headers=a.headers)
    assert r.status_code == 200, r.text
    mine = (await client.get("/api/v1/keys/me", headers=a.headers)).json()["data"]
    assert mine["has_keys"] and mine["enc_public"] == first["enc_public"] and "locked_keys" not in mine

    # A second device must link instead of overwriting the keys
    assert (await client.put("/api/v1/keys/me", json=keys_body(), headers=a.headers)).status_code == 409

    # Fresh start: new keys; the old signing key stays known; chat partners are told
    events.clear()
    second = keys_body(replace=True)
    assert (await client.put("/api/v1/keys/me", json=second, headers=a.headers)).status_code == 200
    keys = (await client.get("/api/v1/keys", params={"user_ids": a.id}, headers=b.headers)).json()["data"][a.id]
    assert keys["sign"] == second["sign_public"] and keys["previous_sign"] == [first["sign_public"]]
    assert any(p["type"] == "keys_changed" and p["userId"] == a.id and b.id in ids for ids, p in events)


async def test_rejects_malformed_keys(client, make_user):
    a = await make_user()
    assert (await client.put("/api/v1/keys/me", json=keys_body(enc_public=b64(31)), headers=a.headers)).status_code == 422
    assert (await client.put("/api/v1/keys/me", json=keys_body(sign_public="not base64!"), headers=a.headers)).status_code == 422


async def test_link_a_new_device(client, make_user, events):
    from app.api.v1.e2e_keys import link_code
    a, other = await make_user(), await make_user()
    # Nothing to link from yet
    pub = b64()
    assert (await client.post("/api/v1/keys/link-requests", json={"ephemeral_public": pub}, headers=a.headers)).status_code == 409
    await client.put("/api/v1/keys/me", json=keys_body(), headers=a.headers)

    # The new device asks; the code is a fingerprint of its one-off key
    r = await client.post("/api/v1/keys/link-requests", json={"ephemeral_public": pub, "device_name": "Chrome on Linux"}, headers=a.headers)
    request = r.json()["data"]
    assert r.status_code == 200 and request["code"] == link_code(pub) and len(request["code"]) == 16
    status = (await client.get(f"/api/v1/keys/link-requests/{request['id']}", headers=a.headers)).json()["data"]
    assert status["status"] == "waiting"

    # The signed-in device finds it by the typed code (dashes and case don't matter); others can't
    typed = "-".join(request["code"][i:i + 4] for i in range(0, 16, 4)).lower()
    found = (await client.get("/api/v1/keys/link-requests", params={"code": typed}, headers=a.headers)).json()["data"]
    assert found["id"] == request["id"] and found["ephemeral_public"] == pub and found["device_name"] == "Chrome on Linux"
    assert (await client.get("/api/v1/keys/link-requests", params={"code": request["code"]}, headers=other.headers)).status_code == 404
    assert (await client.get(f"/api/v1/keys/link-requests/{request['id']}", headers=other.headers)).status_code == 404
    payload = {"e": b64(), "n": b64(24), "c": b64(80)}
    assert (await client.post(f"/api/v1/keys/link-requests/{request['id']}/approve", json={"payload": payload}, headers=other.headers)).status_code == 404

    events.clear()
    r = await client.post(f"/api/v1/keys/link-requests/{request['id']}/approve", json={"payload": payload}, headers=a.headers)
    assert r.status_code == 200
    assert any(p["type"] == "key_link_approved" and p["requestId"] == request["id"] for _, p in events)
    assert (await client.post(f"/api/v1/keys/link-requests/{request['id']}/approve", json={"payload": payload}, headers=a.headers)).status_code == 409

    # The new device collects the encrypted keys once; then they're gone from the server
    done = (await client.get(f"/api/v1/keys/link-requests/{request['id']}", headers=a.headers)).json()["data"]
    assert done["status"] == "approved" and done["payload"] == payload
    assert (await client.get(f"/api/v1/keys/link-requests/{request['id']}", headers=a.headers)).status_code == 404


async def test_link_requests_expire_and_are_limited(client, make_user, db):
    from datetime import datetime, timedelta, timezone
    from app.models.e2e_key import KeyLinkRequest
    a = await make_user()
    await client.put("/api/v1/keys/me", json=keys_body(), headers=a.headers)
    ids = []
    for _ in range(5):
        ids.append((await client.post("/api/v1/keys/link-requests", json={"ephemeral_public": b64()}, headers=a.headers)).json()["data"]["id"])
    assert (await client.post("/api/v1/keys/link-requests", json={"ephemeral_public": b64()}, headers=a.headers)).status_code == 429
    # Cancelling frees a slot
    await client.delete(f"/api/v1/keys/link-requests/{ids[0]}", headers=a.headers)
    r = await client.post("/api/v1/keys/link-requests", json={"ephemeral_public": b64()}, headers=a.headers)
    assert r.status_code == 200
    # Expired requests can't be seen or approved
    request = await db.get(KeyLinkRequest, uuid.UUID(r.json()["data"]["id"]))
    request.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    await db.commit()
    assert (await client.get(f"/api/v1/keys/link-requests/{request.id}", headers=a.headers)).status_code == 404
    # A fresh start cancels pending links (they'd hand out the old keys)
    await client.put("/api/v1/keys/me", json=keys_body(replace=True), headers=a.headers)
    assert (await client.get(f"/api/v1/keys/link-requests/{ids[1]}", headers=a.headers)).status_code == 404


async def test_public_keys_only_for_chat_partners_and_missing_members(client, make_user, make_group):
    a, b, c, outsider = await make_user(), await make_user(), await make_user(), await make_user()
    group = await make_group(a, [b, c])
    for u in (a, b, outsider):
        await client.put("/api/v1/keys/me", json=keys_body(), headers=u.headers)

    data = (await client.get(f"/api/v1/conversations/{group}/keys", headers=a.headers)).json()["data"]
    assert set(data["members"]) == {a.id, b.id} and data["missing"] == [c.id]
    assert (await client.get(f"/api/v1/conversations/{group}/keys", headers=outsider.headers)).status_code == 404

    # Someone you don't share a chat with is left out
    found = (await client.get("/api/v1/keys", params={"user_ids": f"{b.id},{outsider.id}"}, headers=a.headers)).json()["data"]
    assert set(found) == {b.id}
    assert (await client.get("/api/v1/keys", params={"user_ids": "nope"}, headers=a.headers)).status_code == 400


async def test_encrypted_upload_is_stored_as_is(client, make_user):
    a = await make_user()
    blob = os.urandom(70_000)  # not a valid image at all: the server can't and doesn't check
    r = await client.post("/api/v1/media/upload?encrypted=true&kind=image", headers=a.headers,
                          files={"file": ("secret.jpg", blob, "image/jpeg")})
    data = r.json()["data"]
    assert r.status_code == 200, r.text
    assert data["url"].endswith(".enc") and data["filename"] == "file.enc" and data["width"] is None
    served = await client.get(data["signedUrl"])
    assert served.content == blob and served.headers["content-type"] == "application/octet-stream"

    assert (await client.post("/api/v1/media/upload?encrypted=true", headers=a.headers,
                              files={"file": ("x", blob, "application/octet-stream")})).status_code == 400
    # Plain uploads are still checked
    assert (await client.post("/api/v1/media/upload", headers=a.headers,
                              files={"file": ("x.jpg", blob, "image/jpeg")})).status_code == 415


async def test_server_hands_envelopes_to_apps_whole(client, make_user, make_dm, add_message):
    a, b = await make_user(), await make_user()
    dm = await make_dm(a, b)
    secret = envelope(3000)  # longer than any preview cut-off
    first = await add_message(dm, a, secret)
    await add_message(dm, b, envelope(), reply_to_id=uuid.UUID(first))

    chats = (await client.get("/api/v1/conversations", headers=b.headers)).json()["data"]
    chat = next(c for c in chats if c["id"] == dm)
    assert chat["lastMessage"].startswith("e2e1:") and chat["lastMessageSenderId"] == b.id and chat["lastMessageType"] == "text"

    messages = (await client.get(f"/api/v1/conversations/{dm}/messages", headers=a.headers)).json()["data"]
    reply = next(m for m in messages if m.get("reply_to"))
    assert reply["reply_to"]["text"] == secret and reply["reply_to"]["sender_id"] == a.id

    # Push notifications get a label, never the envelope
    assert media_storage.preview_text("text", secret) == "New message"
    assert media_storage.preview_text("image", secret) == "Photo"
    assert media_storage.preview_text("text", "hi") == "hi"


async def test_links_tab_uses_the_senders_flag_for_encrypted_messages(client, make_user, make_dm, add_message):
    a, b = await make_user(), await make_user()
    dm = await make_dm(a, b)
    await add_message(dm, a, envelope(), has_link=True)
    await add_message(dm, a, "e2e1:" + "http" * 20)  # 'http' inside an envelope means nothing
    await add_message(dm, a, "plain https://example.com")
    links = (await client.get(f"/api/v1/conversations/{dm}/shared", params={"kind": "links"}, headers=b.headers)).json()["data"]
    assert [l.get("url") for l in links] == ["https://example.com", None]
    assert links[1]["encrypted"] is True and links[1]["text"].startswith("e2e1:")


async def test_edit_accepts_envelopes_and_keeps_the_plain_limit(client, make_user, make_dm, add_message, db):
    a, b = await make_user(), await make_user()
    dm = await make_dm(a, b)
    mid = await add_message(dm, a, envelope())
    big = envelope(20_000)
    r = await client.patch(f"/api/v1/messages/{mid}", json={"text": big, "has_link": True}, headers=a.headers)
    assert r.status_code == 200, r.text
    saved = await db.get(Message, uuid.UUID(mid), populate_existing=True)
    assert saved.text == big and saved.has_link is True
    assert (await client.patch(f"/api/v1/messages/{mid}", json={"text": "x" * 5001}, headers=a.headers)).status_code == 422


async def test_worker_saves_the_link_flag(db, make_user, make_dm):
    a, b = await make_user(), await make_user()
    dm = await make_dm(a, b)
    worker = MessageWorker.__new__(MessageWorker)
    worker.streams = FakeStreams()
    message_id = str(uuid.uuid4())
    await worker.process_message("1-0", {"data": json.dumps({
        "messageId": message_id, "conversationId": dm, "senderId": a.id, "text": envelope(), "hasLink": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })})
    saved = await db.get(Message, uuid.UUID(message_id))
    assert saved.has_link is True and saved.message_type == MessageType.TEXT
