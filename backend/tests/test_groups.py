async def _details(client, user, conversation_id):
    r = await client.get(f"/api/v1/conversations/{conversation_id}", headers=user.headers)
    return r


async def _system_messages(client, user, conversation_id):
    r = await client.get(f"/api/v1/conversations/{conversation_id}/messages", headers=user.headers)
    return [m["text"] for m in r.json()["data"] if m["message_type"] == "system"]


async def test_only_admins_can_change_group(client, make_user, make_group):
    owner, member = await make_user(), await make_user()
    group = await make_group(owner, [member])
    r = await client.patch(f"/api/v1/conversations/{group}", json={"title": "Hacked"}, headers=member.headers)
    assert r.status_code == 403
    r = await client.post(f"/api/v1/conversations/{group}/members", json={"user_ids": [owner.id]}, headers=member.headers)
    assert r.status_code == 403


async def test_rename_posts_system_message(client, make_user, make_group, events):
    owner, member = await make_user(), await make_user()
    group = await make_group(owner, [member])
    r = await client.patch(f"/api/v1/conversations/{group}", json={"title": "New name"}, headers=owner.headers)
    assert r.status_code == 200
    assert (await _details(client, member, group)).json()["data"]["title"] == "New name"
    assert any("renamed the group" in t for t in await _system_messages(client, member, group))
    assert any(p["type"] == "conversation_updated" for _, p in events)


async def test_added_member_is_notified(client, make_user, make_group, events):
    owner, member, newcomer = await make_user(), await make_user(), await make_user()
    group = await make_group(owner, [member])
    events.clear()
    r = await client.post(f"/api/v1/conversations/{group}/members", json={"user_ids": [newcomer.id]}, headers=owner.headers)
    assert r.status_code == 200
    created = [ids for ids, p in events if p["type"] == "conversation_created"]
    assert created == [[newcomer.id]]
    assert (await _details(client, newcomer, group)).status_code == 200


async def test_removed_member_loses_access(client, make_user, make_group, events):
    owner, member = await make_user(), await make_user()
    group = await make_group(owner, [member])
    r = await client.delete(f"/api/v1/conversations/{group}/members/{member.id}", headers=owner.headers)
    assert r.status_code == 200
    assert (await _details(client, member, group)).status_code == 404
    assert any(p["type"] == "conversation_removed" and ids == [member.id] for ids, p in events)


async def test_last_admin_leaving_promotes_someone(client, make_user, make_group):
    owner, member = await make_user(), await make_user()
    group = await make_group(owner, [member])
    assert (await client.delete(f"/api/v1/conversations/{group}/members/{owner.id}", headers=owner.headers)).status_code == 200
    members = (await _details(client, member, group)).json()["data"]["members"]
    assert [(m["id"], m["role"]) for m in members] == [(member.id, "admin")]


async def test_group_needs_at_least_one_admin(client, make_user, make_group):
    owner, member = await make_user(), await make_user()
    group = await make_group(owner, [member])
    r = await client.patch(f"/api/v1/conversations/{group}/members/{owner.id}", json={"role": "member"}, headers=owner.headers)
    assert r.status_code == 400


async def test_cannot_leave_a_dm(client, make_user, make_dm):
    a, b = await make_user(), await make_user()
    dm = await make_dm(a, b)
    r = await client.delete(f"/api/v1/conversations/{dm}/members/{a.id}", headers=a.headers)
    assert r.status_code == 400
