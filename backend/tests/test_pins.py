async def _pin(client, user, conversation_id, pinned=True):
    return await client.put(f"/api/v1/conversations/{conversation_id}/pin", json={"pinned": pinned}, headers=user.headers)


async def _list(client, user):
    r = await client.get("/api/v1/conversations", headers=user.headers)
    return {c["id"]: c for c in r.json()["data"]}


async def test_pin_and_unpin(client, make_user, make_dm, events):
    a, b = await make_user(), await make_user()
    dm = await make_dm(a, b)
    r = await _pin(client, a, dm)
    assert r.status_code == 200 and r.json()["data"]["pinned"] is True
    assert (await _list(client, a))[dm]["isPinned"] is True
    # pins are personal
    assert (await _list(client, b))[dm]["isPinned"] is False
    assert [ids for ids, p in events if p["type"] == "conversation_pinned"] == [[a.id]]

    assert (await _pin(client, a, dm, pinned=False)).status_code == 200
    assert (await _list(client, a))[dm]["isPinned"] is False


async def test_at_most_three_pinned(client, make_user, make_dm):
    me = await make_user()
    chats = [await make_dm(me, await make_user()) for _ in range(4)]
    for chat in chats[:3]:
        assert (await _pin(client, me, chat)).status_code == 200
    r = await _pin(client, me, chats[3])
    assert r.status_code == 400 and "up to 3" in r.json()["message"]
    # pinning an already pinned chat again is fine
    assert (await _pin(client, me, chats[0])).status_code == 200


async def test_cannot_pin_others_conversations(client, make_user, make_dm):
    a, b, outsider = await make_user(), await make_user(), await make_user()
    dm = await make_dm(a, b)
    assert (await _pin(client, outsider, dm)).status_code == 404
