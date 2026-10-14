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


def test_email_goes_out_over_smtp_when_configured(monkeypatch):
    from app.services import email_service as module

    sent = []

    class FakeSMTP:
        def __init__(self, host, port, timeout=None):
            sent.append(("connect", host, port))
        def __enter__(self):
            return self
        def __exit__(self, *exc):
            return False
        def starttls(self):
            sent.append(("tls",))
        def login(self, user, password):
            sent.append(("login", user))
        def send_message(self, msg):
            sent.append(("send", msg["To"], msg["Subject"]))
            sent.append(("headers", msg["From"], msg["Reply-To"], bool(msg["Message-ID"]), bool(msg["Date"])))

    monkeypatch.setattr(module.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(module.smtplib, "SMTP_SSL", FakeSMTP)
    service = module.EmailService()
    # Fixed settings: never whatever the developer's .env points at
    service.smtp_host, service.smtp_port = "smtp.gmail.com", 587
    service.smtp_user, service.smtp_password, service.from_email = "papyris@gmail.com", "app-password", "papyris@gmail.com"
    assert service.send_verification_code("new@example.com", "new", "123456")
    assert ("login", "papyris@gmail.com") in sent
    assert ("send", "new@example.com", "123456 is your ShareEven code") in sent

    # A sending service on port 465 (TLS from the start), from noreply@ with replies to support@
    sent.clear()
    service.smtp_host, service.smtp_port = "smtp.resend.com", 465
    service.smtp_user, service.smtp_password, service.from_email = "resend", "re_key", "noreply@shareeven.com"
    assert service.send_verification_code("new@example.com", "new", "123456")
    assert ("connect", "smtp.resend.com", 465) in sent and ("tls",) not in sent
    assert ("headers", "ShareEven <noreply@shareeven.com>", "support@shareeven.com", True, True) in sent

    unconfigured = module.EmailService()
    unconfigured.smtp_user = unconfigured.smtp_password = ""
    unconfigured.environment = "production"
    assert unconfigured.send_verification_code("new@example.com", "new", "123456") is False


async def test_forgot_password_says_when_no_account(client, make_user, monkeypatch):
    from app.api.v1 import auth as auth_api
    sent = []
    monkeypatch.setattr(auth_api.email_service, "send_password_reset_email", lambda *a: sent.append(a) or True)
    r = await client.post("/api/v1/auth/forgot-password", json={"identifier": "nobody-here@example.com"})
    assert r.status_code == 404 and r.json()["code"] == "account_not_found"
    assert sent == []

    user = await make_user("forgot")
    r = await client.post("/api/v1/auth/forgot-password", json={"identifier": user.username})
    assert r.status_code == 200
    assert r.json()["data"]["email"] == f"{user.email[:2]}•••@example.com"  # partly hidden
    assert sent and sent[0][0] == user.email


async def test_sign_up_catches_email_typos_and_dead_domains(client, monkeypatch):
    from app.config.settings import settings
    from app.core import email_check
    monkeypatch.setattr(settings, "EMAIL_DOMAIN_CHECK", True)
    monkeypatch.setattr(email_check, "_check_dns", lambda email: None if email.endswith(("gmail.com", "gmial.com")) else "We can't send email to nowhere.zz. Check the address for typos.")
    body = {"username": "typo_" + "a" * 4, "email": "sai@gmial.com", "password": "Passw0rd!23"}

    r = await client.post("/api/v1/auth/register", json=body)
    assert r.status_code == 400 and r.json()["code"] == "email_typo"
    assert r.json()["data"]["suggestion"] == "sai@gmail.com"

    # Kept their address after seeing the suggestion: allowed (the domain still has to work)
    r = await client.post("/api/v1/auth/register", json={**body, "email_typo_checked": True})
    assert r.status_code == 201, r.text

    r = await client.post("/api/v1/auth/register", json={**body, "username": "deadend", "email": "sai@nowhere.zz", "email_typo_checked": True})
    assert r.status_code == 400 and r.json()["code"] == "email_undeliverable"


def test_typo_suggestions():
    from app.core.email_check import typo_suggestion
    assert typo_suggestion("a@gmial.com") == "a@gmail.com"
    assert typo_suggestion("a@outlok.com") == "a@outlook.com"
    for fine in ("a@gmail.com", "a@mail.com", "a@gmx.com", "a@protonmail.ch", "a@tcd.ie", "a@company.com"):
        assert typo_suggestion(fine) is None
