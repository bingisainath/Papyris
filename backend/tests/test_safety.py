"""Blocking people and reporting abuse."""

import uuid

from sqlalchemy import update

from app.models.user import User
from app.services import push, safety


async def _block(client, me, other):
    return await client.post(f"/api/v1/users/{other.id}/block", headers=me.headers)


async def test_block_list_and_unblock(client, make_user, events):
    a, b = await make_user(), await make_user()
    assert (await client.post(f"/api/v1/users/{a.id}/block", headers=a.headers)).status_code == 400
    assert (await _block(client, a, b)).status_code == 200
    assert (await _block(client, a, b)).status_code == 200  # twice is fine
    listed = (await client.get("/api/v1/users/blocked", headers=a.headers)).json()["data"]
    assert [p["id"] for p in listed] == [b.id]
    assert any(p["type"] == "block_changed" and p["blocked"] for ids, p in events if ids == [a.id])
    assert not any(b.id in ids for ids, p in events if p["type"] == "block_changed")  # b isn't told
    assert (await client.delete(f"/api/v1/users/{b.id}/block", headers=a.headers)).status_code == 200
    assert (await client.get("/api/v1/users/blocked", headers=a.headers)).json()["data"] == []


async def test_block_stops_direct_messages_both_ways(client, db, make_user, make_dm, make_group):
    a, b, c = await make_user(), await make_user(), await make_user()
    dm = await make_dm(a, b)
    group = await make_group(a, [b, c])
    await _block(client, a, b)
    assert await safety.direct_message_refusal(db, uuid.UUID(dm), uuid.UUID(a.id)) == safety.YOU_BLOCKED
    assert await safety.direct_message_refusal(db, uuid.UUID(dm), uuid.UUID(b.id)) == safety.CANT_MESSAGE
    assert await safety.direct_message_refusal(db, uuid.UUID(group), uuid.UUID(b.id)) is None  # groups go on

    chats = {c["id"]: c for c in (await client.get("/api/v1/conversations", headers=a.headers)).json()["data"]}
    assert chats[dm]["isBlocked"] is True and chats[dm]["otherUserId"] == b.id
    theirs = {c["id"]: c for c in (await client.get("/api/v1/conversations", headers=b.headers)).json()["data"]}
    assert theirs[dm]["isBlocked"] is False  # b can't tell from the list


async def test_block_stops_new_chats_and_group_adds(client, make_user, make_group):
    a, b, c = await make_user(), await make_user(), await make_user()
    await _block(client, b, a)  # b blocked a
    r = await client.post("/api/v1/conversations", json={"kind": "dm", "participant_ids": [b.id]}, headers=a.headers)
    assert r.status_code == 403
    r = await client.post("/api/v1/conversations", json={"kind": "group", "title": "x", "participant_ids": [b.id, c.id]}, headers=a.headers)
    assert r.status_code == 403
    group = await make_group(a, [c])
    r = await client.post(f"/api/v1/conversations/{group}/members", json={"user_ids": [b.id]}, headers=a.headers)
    assert r.status_code == 403
    # b can still add a: only the blocker is protected
    group_b = await make_group(b, [c])
    r = await client.post(f"/api/v1/conversations/{group_b}/members", json={"user_ids": [a.id]}, headers=b.headers)
    assert r.status_code == 200


async def test_no_push_from_someone_you_blocked(db, make_user, make_group, add_message, monkeypatch):
    from app.models.message import Message
    from app.worker import MessageWorker
    a, b, c = await make_user(), await make_user(), await make_user()
    group = await make_group(a, [b, c])
    await db.execute(__import__("sqlalchemy").text(
        "insert into user_blocks (blocker_id, blocked_id) values (:b, :a)"), {"a": uuid.UUID(a.id), "b": uuid.UUID(b.id)})
    await db.commit()
    sent = []

    async def fake_send(db_, user_ids, title, body, data, app_renders=False):
        sent.extend(user_ids)
    monkeypatch.setattr(push, "enabled", lambda: True)
    monkeypatch.setattr(push, "send_to_users", fake_send)
    msg_id = await add_message(group, a, "hi all")
    message = await db.get(Message, uuid.UUID(msg_id))
    worker = MessageWorker.__new__(MessageWorker)
    await worker.notify(db, message, {"senderName": "a"}, [uuid.UUID(b.id), uuid.UUID(c.id)])
    assert sent == [uuid.UUID(c.id)]


async def test_report_a_message_and_review_it(client, db, make_user, make_dm, add_message, events):
    a, b, admin, outsider = await make_user(), await make_user(), await make_user(), await make_user()
    dm = await make_dm(a, b)
    msg = await add_message(dm, b, "send me your bank PIN")

    r = await client.post("/api/v1/reports", json={"message_id": msg, "reason": "scam", "evidence": "send me your bank PIN",
                                                    "block": True}, headers=a.headers)
    assert r.status_code == 200 and r.json()["data"]["blocked"] is True
    assert [p["id"] for p in (await client.get("/api/v1/users/blocked", headers=a.headers)).json()["data"]] == [b.id]
    # Someone outside the chat can't report its messages, and nobody can report themselves
    assert (await client.post("/api/v1/reports", json={"message_id": msg, "reason": "spam"}, headers=outsider.headers)).status_code == 404
    assert (await client.post("/api/v1/reports", json={"user_id": a.id, "reason": "spam"}, headers=a.headers)).status_code == 400
    assert (await client.post("/api/v1/reports", json={"reason": "spam"}, headers=a.headers)).status_code == 400

    # Only app admins review
    assert (await client.get("/api/v1/admin/reports", headers=a.headers)).status_code == 403
    await db.execute(update(User).where(User.id == uuid.UUID(admin.id)).values(is_app_admin=True))
    await db.commit()
    reports = (await client.get("/api/v1/admin/reports", headers=admin.headers)).json()["data"]
    assert len(reports) == 1
    report = reports[0]
    assert report["reported_user"]["id"] == b.id and report["reporter"]["id"] == a.id
    assert report["evidence"] == "send me your bank PIN" and report["times_reported"] == 1
    r = await client.post(f"/api/v1/admin/reports/{report['id']}/resolve", json={"resolution": "Warned the user"}, headers=admin.headers)
    assert r.status_code == 200
    assert (await client.get("/api/v1/admin/reports", headers=admin.headers)).json()["data"] == []
    resolved = (await client.get("/api/v1/admin/reports", params={"status": "resolved"}, headers=admin.headers)).json()["data"]
    assert resolved[0]["resolution"] == "Warned the user"


async def _admin(db, make_user):
    admin = await make_user()
    await db.execute(update(User).where(User.id == uuid.UUID(admin.id)).values(is_app_admin=True))
    await db.commit()
    return admin


async def _report(client, reporter, reported, reason="harassment"):
    r = await client.post("/api/v1/reports", json={"user_id": reported.id, "reason": reason}, headers=reporter.headers)
    assert r.status_code == 200, r.text


async def _notices(client, user):
    return (await client.get("/api/v1/notices", headers=user.headers)).json()["data"]


async def test_a_warning_reaches_the_reported_person_without_naming_the_reporter(client, db, make_user, events):
    reporter, reported = await make_user("reporter_ann"), await make_user("rude_rob")
    admin = await _admin(db, make_user)
    await _report(client, reporter, reported)
    report = (await client.get("/api/v1/admin/reports", headers=admin.headers)).json()["data"][0]

    # Nobody hears anything just because a report was made
    assert (await _notices(client, reported))["notices"] == []

    r = await client.post(f"/api/v1/admin/reports/{report['id']}/resolve", headers=admin.headers, json={
        "resolution": "Rude messages, first time", "outcome": "no_violation",  # warning overrides this
        "warn": True, "warning_message": "Please keep your messages respectful.",
    })
    assert r.status_code == 200, r.text
    assert r.json()["data"] == {"id": report["id"], "outcome": "action_taken", "warned": True}

    warned = await _notices(client, reported)
    assert warned["unread"] == 1
    notice = warned["notices"][0]
    assert notice["kind"] == "warning" and notice["reason"] == "harassment"
    assert "harassing or bullying" in notice["body"] and "Please keep your messages respectful." in notice["body"]
    assert "reporter_ann" not in notice["body"] and "report" not in notice["body"].lower()  # never who, or that anyone did

    update_ = (await _notices(client, reporter))["notices"][0]
    assert update_["kind"] == "report_update" and update_["reason"] == "action_taken"
    assert "took action" in update_["body"] and "rude_rob" in update_["body"]
    assert "respectful" not in update_["body"]  # not what the action was

    # Both apps are told live, each about their own notice only
    live = [(ids, p["notice"]["kind"]) for ids, p in events if p["type"] == "account_notice"]
    assert sorted(live) == sorted([([reported.id], "warning"), ([reporter.id], "report_update")])

    # Can't be resolved twice (no second round of notices)
    again = await client.post(f"/api/v1/admin/reports/{report['id']}/resolve", headers=admin.headers, json={"resolution": "x", "warn": True})
    assert again.status_code == 409

    # Reading: one, then all
    await client.post("/api/v1/notices/read", json={"ids": [notice["id"]]}, headers=reported.headers)
    assert (await _notices(client, reported))["unread"] == 0
    detail = (await client.get(f"/api/v1/admin/users/{reported.id}", headers=admin.headers)).json()["data"]
    assert detail["counts"]["warnings"] == 1


async def test_no_violation_tells_only_the_reporter(client, db, make_user, events):
    reporter, reported = await make_user(), await make_user()
    admin = await _admin(db, make_user)
    await _report(client, reporter, reported, "spam")
    report = (await client.get("/api/v1/admin/reports", headers=admin.headers)).json()["data"][0]
    r = await client.post(f"/api/v1/admin/reports/{report['id']}/resolve", headers=admin.headers,
                          json={"resolution": "Looks fine", "outcome": "no_violation"})
    assert r.status_code == 200, r.text
    assert (await _notices(client, reported))["notices"] == []
    told = (await _notices(client, reporter))["notices"]
    assert len(told) == 1 and "didn't find a breach" in told[0]["body"]


async def test_resolving_without_an_outcome_tells_nobody(client, db, make_user):
    reporter, reported = await make_user(), await make_user()
    admin = await _admin(db, make_user)
    await _report(client, reporter, reported)
    report = (await client.get("/api/v1/admin/reports", headers=admin.headers)).json()["data"][0]
    assert (await client.post(f"/api/v1/admin/reports/{report['id']}/resolve", headers=admin.headers,
                              json={"resolution": "Duplicate"})).status_code == 200
    assert (await _notices(client, reporter))["notices"] == [] and (await _notices(client, reported))["notices"] == []


async def test_admins_can_warn_from_the_account_page(client, db, make_user, events):
    person = await make_user()
    admin = await _admin(db, make_user)
    assert (await client.post(f"/api/v1/admin/users/{person.id}/warn", json={"reason": "spam"}, headers=person.headers)).status_code == 403
    assert (await client.post(f"/api/v1/admin/users/{person.id}/warn", json={"reason": "made-up"}, headers=admin.headers)).status_code == 400
    r = await client.post(f"/api/v1/admin/users/{person.id}/warn", json={"reason": "spam", "message": "Too many group invites."},
                          headers=admin.headers)
    assert r.status_code == 200, r.text
    notice = (await _notices(client, person))["notices"][0]
    assert notice["kind"] == "warning" and "Too many group invites." in notice["body"]
    actions = (await client.get(f"/api/v1/admin/users/{person.id}", headers=admin.headers)).json()["data"]["admin_actions"]
    assert actions[0]["action"] == "warn" and actions[0]["details"]["rule"] == "spam"
    # Notices are private
    other = await make_user()
    assert (await _notices(client, other))["notices"] == []
    await client.post("/api/v1/notices/read", json={}, headers=other.headers)  # marks only their own
    assert (await _notices(client, person))["unread"] == 1
