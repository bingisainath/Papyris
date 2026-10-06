"""Sign-up sends a 6-digit code; the account can't log in until it's verified."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update

from app.models.user import User
from tests.conftest import PASSWORD


async def register(client, name):
    email = f"{name}@example.com"
    r = await client.post("/api/v1/auth/register", json={"username": name, "email": email, "password": PASSWORD})
    assert r.status_code == 201, r.text
    return email


async def test_login_blocked_until_verified_then_code_signs_in(client, sent_codes, db):
    email = await register(client, "otp_alice")
    code = sent_codes[email]
    assert len(code) == 6 and code.isdigit()
    stored = (await db.execute(select(User).where(User.email == email))).scalar_one()
    assert stored.email_verified is False and code not in (stored.email_code_hash or "")

    r = await client.post("/api/v1/auth/login", json={"identifier": "otp_alice", "password": PASSWORD})
    assert r.status_code == 403
    assert r.json()["code"] == "email_not_verified" and r.json()["data"]["email"] == email

    wrong = "000000" if code != "000000" else "111111"
    r = await client.post("/api/v1/auth/verify-email", json={"identifier": email, "code": wrong})
    assert r.status_code == 400

    r = await client.post("/api/v1/auth/verify-email", json={"identifier": "otp_alice", "code": code})
    assert r.status_code == 200
    assert r.json()["data"]["access_token"]

    r = await client.post("/api/v1/auth/login", json={"identifier": "otp_alice", "password": PASSWORD})
    assert r.status_code == 200


async def test_attempt_limit_expiry_and_resend(client, sent_codes, db):
    email = await register(client, "otp_bob")
    first = sent_codes[email]
    wrong = "000000" if first != "000000" else "111111"
    for _ in range(5):
        await client.post("/api/v1/auth/verify-email", json={"identifier": email, "code": wrong})
    r = await client.post("/api/v1/auth/verify-email", json={"identifier": email, "code": first})
    assert r.status_code == 429  # locked after 5 wrong tries, even with the right code

    r = await client.post("/api/v1/auth/resend-code", json={"identifier": email})
    assert r.status_code == 429  # one per minute

    await db.execute(update(User).where(User.email == email).values(
        email_code_sent_at=datetime.now(timezone.utc) - timedelta(minutes=2)))
    await db.commit()
    r = await client.post("/api/v1/auth/resend-code", json={"identifier": email})
    assert r.status_code == 200
    second = sent_codes[email]

    await db.execute(update(User).where(User.email == email).values(
        email_code_expires=datetime.now(timezone.utc) - timedelta(seconds=1)))
    await db.commit()
    r = await client.post("/api/v1/auth/verify-email", json={"identifier": email, "code": second})
    assert r.status_code == 400 and "expired" in r.json()["message"]


async def test_resend_does_not_reveal_accounts(client):
    r = await client.post("/api/v1/auth/resend-code", json={"identifier": "nobody-here@example.com"})
    assert r.status_code == 200
    r = await client.post("/api/v1/auth/verify-email", json={"identifier": "nobody-here@example.com", "code": "123456"})
    assert r.status_code == 400
