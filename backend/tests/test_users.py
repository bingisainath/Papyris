async def _search(client, user, query=None):
    params = {"search": query} if query is not None else {}
    r = await client.get("/api/v1/users", params=params, headers=user.headers)
    assert r.status_code == 200
    return r.json()["data"]


async def test_search_never_returns_emails(client, make_user):
    me, other = await make_user("finder"), await make_user("findme")
    results = await _search(client, me, other.username[:6])
    assert any(u["id"] == other.id for u in results)
    assert all("email" not in u for u in results)


async def test_search_needs_two_characters(client, make_user):
    me = await make_user()
    assert await _search(client, me, "f") == []


async def test_email_matches_only_exactly(client, make_user):
    me, other = await make_user(), await make_user()
    assert [u["id"] for u in await _search(client, me, other.email)] == [other.id]
    domain = "@" + other.email.split("@")[1]
    assert await _search(client, me, domain) == []


async def test_like_wildcards_are_literal(client, make_user):
    me = await make_user()
    assert await _search(client, me, "%%") == []
    assert await _search(client, me, "__") == []


async def test_without_search_only_contacts(client, make_user, make_dm):
    me, friend, stranger = await make_user(), await make_user(), await make_user()
    await make_dm(me, friend)
    ids = {u["id"] for u in await _search(client, me)}
    assert friend.id in ids
    assert stranger.id not in ids
