"""Mute, archive and message search (per person)."""

from datetime import datetime, timezone


async def chat_in_list(client, user, conversation_id):
    data = (await client.get("/api/v1/conversations", headers=user.headers)).json()["data"]
    return next(c for c in data if c["id"] == conversation_id)


async def test_mute_and_archive_are_personal(client, make_user, make_group, events):
    a, b = await make_user(), await make_user()
    group = await make_group(a, [b], "Flat")
    events.clear()
    r = await client.put(f"/api/v1/conversations/{group}/mute", json={"duration": "8h"}, headers=a.headers)
    assert r.status_code == 200, r.text
    until = datetime.fromisoformat((await chat_in_list(client, a, group))["mutedUntil"])
    assert 7.9 * 3600 < (until - datetime.now(timezone.utc)).total_seconds() <= 8 * 3600
    assert (await chat_in_list(client, b, group))["mutedUntil"] is None  # only for a
    assert all(ids == [a.id] for ids, p in events if p.get("type") == "conversation_prefs")
    await client.put(f"/api/v1/conversations/{group}/mute", json={"duration": "always"}, headers=a.headers)
    assert (await chat_in_list(client, a, group))["mutedUntil"] > "2100"
    await client.put(f"/api/v1/conversations/{group}/mute", json={"duration": None}, headers=a.headers)
    assert (await chat_in_list(client, a, group))["mutedUntil"] is None
    assert (await client.put(f"/api/v1/conversations/{group}/mute", json={"duration": "2y"}, headers=a.headers)).status_code == 422

    # Archiving unpins and hides it only for a
    await client.put(f"/api/v1/conversations/{group}/pin", json={"pinned": True}, headers=a.headers)
    r = await client.put(f"/api/v1/conversations/{group}/archive", json={"archived": True}, headers=a.headers)
    assert r.status_code == 200, r.text
    chat = await chat_in_list(client, a, group)
    assert chat["isArchived"] is True and chat["isPinned"] is False
    assert (await chat_in_list(client, b, group))["isArchived"] is False
    await client.put(f"/api/v1/conversations/{group}/archive", json={"archived": False}, headers=a.headers)
    assert (await chat_in_list(client, a, group))["isArchived"] is False


async def test_muted_members_get_no_push(make_user, make_group, add_message, db, monkeypatch):
    from app import worker as worker_module
    from app.models.conversation_member import ConversationMember
    from sqlalchemy import update
    import uuid
    a, b, c = await make_user(), await make_user(), await make_user()
    group = await make_group(a, [b, c], "Flat")
    await db.execute(update(ConversationMember).where(ConversationMember.user_id == uuid.UUID(b.id))
                     .values(muted_until=datetime(2999, 1, 1, tzinfo=timezone.utc)))
    await db.commit()
    notified = []

    async def fake_notify(self, db, message, data, recipient_ids):
        notified.extend(str(u) for u in recipient_ids)

    monkeypatch.setattr(worker_module.MessageWorker, "notify", fake_notify)
    w = worker_module.MessageWorker.__new__(worker_module.MessageWorker)

    class FakeStreams:
        async def ack_message(self, msg_id):
            pass

    w.streams = FakeStreams()
    import json
    msg_id = str(uuid.uuid4())
    await w.process_message("1-0", {"data": json.dumps({
        "messageId": msg_id, "conversationId": group, "senderId": a.id, "senderName": "a", "text": "hi",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })})
    assert notified == [c.id]  # b muted the chat


async def test_search_finds_plain_text_in_your_chats_only(client, make_user, make_group, make_dm, add_message):
    a, b, outsider = await make_user(), await make_user(), await make_user()
    group = await make_group(a, [b], "Trip")
    dm = await make_dm(a, b)
    await add_message(group, b, "Train tickets booked for Friday")
    await add_message(dm, a, "the TRAIN leaves at 9")
    await add_message(group, a, "e2e2:")  # encrypted: never matched on the server
    await add_message(group, b, "50% off at the shop")

    def search(user, q, **params):
        return client.get("/api/v1/messages/search", params={"q": q, **params}, headers=user.headers)

    found = (await search(a, "train")).json()["data"]
    assert [m["text"] for m in found] == ["the TRAIN leaves at 9", "Train tickets booked for Friday"]
    assert found[1]["conversationTitle"] == "Trip" and found[1]["isGroup"] is True
    assert [m["text"] for m in (await search(a, "train", conversation_id=group)).json()["data"]] == ["Train tickets booked for Friday"]
    assert [m["text"] for m in (await search(a, "50%")).json()["data"]] == ["50% off at the shop"]
    assert (await search(a, "e2e2")).json()["data"] == []
    assert (await search(outsider, "train")).json()["data"] == []
    assert (await search(a, "t")).status_code == 422
