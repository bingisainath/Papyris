from sqlalchemy import event

from app.db.session import engine


async def _conversations(client, user):
    r = await client.get("/api/v1/conversations", headers=user.headers)
    assert r.status_code == 200
    return {c["id"]: c for c in r.json()["data"]}


async def test_dm_is_created_once(client, make_user, make_dm):
    a, b = await make_user(), await make_user()
    first = await make_dm(a, b)
    again = await make_dm(a, b)
    assert first == again


async def test_group_creation_notifies_every_member(client, make_user, make_group, events):
    owner, m1, m2 = await make_user(), await make_user(), await make_user()
    group_id = await make_group(owner, [m1, m2], "Trip")
    created = [(ids, p) for ids, p in events if p["type"] == "conversation_created"]
    assert created and set(created[0][0]) == {owner.id, m1.id, m2.id}
    assert created[0][1]["conversationId"] == group_id


async def test_list_shows_last_message_and_unread(client, make_user, make_dm, add_message):
    a, b = await make_user(), await make_user()
    dm = await make_dm(a, b)
    await add_message(dm, a, "one")
    await add_message(dm, a, "two")
    conv = (await _conversations(client, b))[dm]
    assert conv["lastMessage"] == "two"
    assert conv["unreadCount"] == 2
    assert conv["name"] == a.username
    # own messages are never unread
    assert (await _conversations(client, a))[dm]["unreadCount"] == 0


async def test_mark_read_clears_unread_and_notifies(client, make_user, make_dm, add_message, events):
    a, b = await make_user(), await make_user()
    dm = await make_dm(a, b)
    await add_message(dm, a, "hi")
    r = await client.post(f"/api/v1/conversations/{dm}/mark-read", headers=b.headers)
    assert r.status_code == 200
    assert (await _conversations(client, b))[dm]["unreadCount"] == 0
    assert any(p["type"] == "read" and p["userId"] == b.id for _, p in events)


async def test_list_uses_constant_number_of_queries(client, make_user, make_dm, make_group, add_message):
    """Regression guard: the list used to run ~7 queries per conversation."""
    me = await make_user()
    queries = []

    def count(*_args, **_kwargs):
        queries.append(1)

    async def queries_for_list():
        queries.clear()
        event.listen(engine.sync_engine, "before_cursor_execute", count)
        try:
            await _conversations(client, me)
        finally:
            event.remove(engine.sync_engine, "before_cursor_execute", count)
        return len(queries)

    other = await make_user()
    await add_message(await make_dm(me, other), other)
    small = await queries_for_list()
    for _ in range(4):
        await add_message(await make_group(me, [await make_user()]), me)
    assert await queries_for_list() == small


async def test_non_member_cannot_read_messages(client, make_user, make_dm):
    a, b, outsider = await make_user(), await make_user(), await make_user()
    dm = await make_dm(a, b)
    r = await client.get(f"/api/v1/conversations/{dm}/messages", headers=outsider.headers)
    assert r.status_code == 403
