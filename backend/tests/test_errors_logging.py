import logging
import uuid

from jose import jwt

from app.config.settings import settings
from app.main import app


async def test_unexpected_errors_are_generic_and_keep_cors(client):
    async def boom():
        raise RuntimeError("secret internal detail")

    app.add_api_route("/api/v1/_test_boom", boom)
    try:
        r = await client.get("/api/v1/_test_boom", headers={"Origin": "http://localhost:3000"})
    finally:
        app.router.routes = [route for route in app.router.routes if getattr(route, "path", "") != "/api/v1/_test_boom"]
    assert r.status_code == 500
    assert r.json()["success"] is False
    assert "secret" not in r.text
    # browsers can read the error (CORS headers present on the 500)
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"


async def test_reset_token_never_logged_by_auth(client, db, make_user, caplog):
    from app.models.user import User

    user = await make_user()
    with caplog.at_level(logging.DEBUG, logger="app.api.v1.auth"):
        r = await client.post("/api/v1/auth/forgot-password", json={"identifier": user.email})
    assert r.status_code == 200
    token = (await db.get(User, uuid.UUID(user.id), populate_existing=True)).reset_token
    assert token
    auth_logs = [rec.getMessage() for rec in caplog.records if rec.name == "app.api.v1.auth"]
    assert auth_logs and not any(token in m for m in auth_logs)


async def test_malformed_subject_is_401_not_500(client):
    token = jwt.encode({"sub": "not-a-uuid", "type": "access"}, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    r = await client.get("/api/v1/conversations", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_tokens_and_signatures_are_redacted_in_server_logs():
    from app.core.logging import RedactSecrets

    record = logging.LogRecord(
        "uvicorn.error", logging.INFO, __file__, 1, '%s - "WebSocket %s" [accepted]',
        (("127.0.0.1", 5000), "/api/v1/ws/chat?token=eyJsecret.payload.sig"), None,
    )
    RedactSecrets().filter(record)
    assert "eyJsecret" not in record.getMessage() and "token=[redacted]" in record.getMessage()

    record = logging.LogRecord(
        "uvicorn.access", logging.INFO, __file__, 1, "GET %s", ("/api/v1/media/a.png?exp=1&sig=abc123",), None,
    )
    RedactSecrets().filter(record)
    assert record.getMessage() == "GET /api/v1/media/a.png?exp=1&sig=[redacted]"
