async def _history(client, user, conversation_id, **params):
    r = await client.get(f"/api/v1/conversations/{conversation_id}/messages", params=params, headers=user.headers)
    assert r.status_code == 200
    return r.json()


async def test_history_returns_newest_page_oldest_first(client, make_user, make_dm, add_message):
    a, b = await make_user(), await make_user()
    dm = await make_dm(a, b)
    for i in range(7):
        await add_message(dm, a, f"m{i}")
    page = await _history(client, b, dm, limit=5)
    assert [m["text"] for m in page["data"]] == ["m2", "m3", "m4", "m5", "m6"]
    assert page["has_more"] is True
    older = await _history(client, b, dm, limit=5, before=page["data"][0]["id"])
    assert [m["text"] for m in older["data"]] == ["m0", "m1"]
    assert older["has_more"] is False


async def test_reply_preview_in_history(client, make_user, make_dm, add_message):
    import uuid
    a, b = await make_user(), await make_user()
    dm = await make_dm(a, b)
    original = await add_message(dm, a, "original")
    await add_message(dm, b, "answer", reply_to_id=uuid.UUID(original))
    reply = (await _history(client, a, dm))["data"][-1]
    assert reply["reply_to"]["id"] == original
    assert reply["reply_to"]["text"] == "original"


async def test_edit_own_message(client, make_user, make_dm, add_message, events):
    a, b = await make_user(), await make_user()
    dm = await make_dm(a, b)
    msg = await add_message(dm, a, "typo")
    r = await client.patch(f"/api/v1/messages/{msg}", json={"text": "fixed"}, headers=a.headers)
    assert r.status_code == 200
    edited = (await _history(client, b, dm))["data"][-1]
    assert edited["text"] == "fixed" and edited["edited_at"]
    assert any(p["type"] == "message_updated" and p["text"] == "fixed" for _, p in events)


async def test_cannot_edit_or_delete_others_messages(client, make_user, make_dm, add_message):
    a, b = await make_user(), await make_user()
    dm = await make_dm(a, b)
    msg = await add_message(dm, a, "mine")
    assert (await client.patch(f"/api/v1/messages/{msg}", json={"text": "x"}, headers=b.headers)).status_code == 403
    assert (await client.delete(f"/api/v1/messages/{msg}", headers=b.headers)).status_code == 403


async def test_outsider_cannot_touch_messages(client, make_user, make_dm, add_message):
    a, b, outsider = await make_user(), await make_user(), await make_user()
    msg = await add_message(await make_dm(a, b), a, "private")
    assert (await client.put(f"/api/v1/messages/{msg}/reaction", json={"emoji": "👍"}, headers=outsider.headers)).status_code == 404


async def test_delete_for_everyone(client, make_user, make_dm, add_message):
    a, b = await make_user(), await make_user()
    dm = await make_dm(a, b)
    msg = await add_message(dm, a, "oops")
    assert (await client.delete(f"/api/v1/messages/{msg}", headers=a.headers)).status_code == 200
    deleted = (await _history(client, b, dm))["data"][-1]
    assert deleted["is_deleted"] is True and deleted["text"] == ""
    conv = [c for c in (await client.get("/api/v1/conversations", headers=b.headers)).json()["data"] if c["id"] == dm][0]
    assert conv["lastMessage"] == "This message was deleted"


async def test_reactions_toggle_and_replace(client, make_user, make_dm, add_message):
    a, b = await make_user(), await make_user()
    dm = await make_dm(a, b)
    msg = await add_message(dm, a, "nice")

    async def react(user, emoji):
        r = await client.put(f"/api/v1/messages/{msg}/reaction", json={"emoji": emoji}, headers=user.headers)
        assert r.status_code == 200
        return r.json()["data"]["reactions"]

    assert await react(b, "👍") == [{"emoji": "👍", "userIds": [b.id]}]
    assert await react(b, "❤️") == [{"emoji": "❤️", "userIds": [b.id]}]  # one reaction per person
    assert await react(b, "❤️") == []  # same emoji again removes it


async def test_unsupported_reaction_rejected(client, make_user, make_dm, add_message):
    a, b = await make_user(), await make_user()
    msg = await add_message(await make_dm(a, b), a)
    r = await client.put(f"/api/v1/messages/{msg}/reaction", json={"emoji": "<script>"}, headers=b.headers)
    assert r.status_code == 400
