import pytest

from app.config.settings import settings
from app.core import rate_limit as rl


async def _login(client, identifier):
    return await client.post("/api/v1/auth/login", json={"identifier": identifier, "password": "Wrong-pass1!"})


async def test_login_locks_an_account_after_ten_tries(client, make_user, rate_limits):
    user = await make_user()
    rate_limits.counts.clear()  # making the user logged in once
    for _ in range(rl.LOGIN_PER_ACCOUNT.times):
        assert (await _login(client, user.username)).status_code == 401
    r = await _login(client, user.username)
    assert r.status_code == 429
    assert int(r.headers["retry-after"]) > 0
    assert r.json()["message"].startswith("Too many attempts. Try again in")
    # The same account by email, or with different capitals, is the same account
    assert (await _login(client, user.username.upper())).status_code == 429


async def test_one_ip_can_try_many_accounts_only_so_far(client):
    for n in range(rl.LOGIN_PER_IP.times):
        assert (await _login(client, f"nobody{n}")).status_code == 401
    assert (await _login(client, "someone-new")).status_code == 429


async def test_unknown_account_and_wrong_password_look_the_same(client, make_user):
    user = await make_user()
    unknown, wrong = await _login(client, "no-such-person"), await _login(client, user.username)
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["message"] == wrong.json()["message"]


async def test_forgot_password_per_account(client, make_user):
    user = await make_user()
    for _ in range(rl.FORGOT_PER_ACCOUNT.times):
        r = await client.post("/api/v1/auth/forgot-password", json={"identifier": user.email})
        assert r.status_code == 200
    r = await client.post("/api/v1/auth/forgot-password", json={"identifier": user.email})
    assert r.status_code == 429


async def test_sign_ups_per_ip(client):
    for n in range(rl.REGISTER_PER_IP.times):
        r = await client.post("/api/v1/auth/register", json={
            "username": f"rlnew{n}", "email": f"rlnew{n}@example.com", "password": "Passw0rd!23"})
        assert r.status_code == 201, r.text
    r = await client.post("/api/v1/auth/register", json={
        "username": "rlnew99", "email": "rlnew99@example.com", "password": "Passw0rd!23"})
    assert r.status_code == 429


async def test_messages_per_user_and_window():
    for _ in range(rl.MESSAGES_PER_USER.times):
        assert await rl.check(rl.MESSAGES_PER_USER, "user-1") is None
    assert await rl.check(rl.MESSAGES_PER_USER, "user-1") is not None
    assert await rl.check(rl.MESSAGES_PER_USER, "user-2") is None  # someone else is unaffected


async def test_redis_down_lets_requests_through(monkeypatch):
    class Broken:
        async def incr(self, key, ttl):
            raise ConnectionError("redis is down")
    monkeypatch.setattr(rl, "_counter", Broken())
    assert await rl.check(rl.LOGIN_PER_IP, "1.2.3.4") is None


async def test_can_be_switched_off(monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMITS_ENABLED", False)
    for _ in range(rl.FORGOT_PER_ACCOUNT.times + 5):
        assert await rl.check(rl.FORGOT_PER_ACCOUNT, "someone") is None


async def test_redis_counter_counts_and_expires():
    from redis.asyncio import Redis
    counter = rl._RedisCounter()
    counter.redis = Redis.from_url("redis://localhost:6379/15", decode_responses=True)
    try:
        await counter.redis.ping()
    except Exception:
        pytest.skip("Redis isn't running on localhost:6379")
    key = "papyris:rl:test:counter"
    await counter.redis.delete(key)
    assert [await counter.incr(key, 30) for _ in range(3)] == [1, 2, 3]
    assert 0 < await counter.redis.ttl(key) <= 30
    await counter.redis.delete(key)
    await counter.redis.close()
