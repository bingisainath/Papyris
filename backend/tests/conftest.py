"""
Test setup.

- A throwaway database (`<your db>_test`) is created on the same Postgres server,
  migrated with Alembic, and dropped after the run.
- WebSocket/Redis events are captured in memory (the `events` fixture) instead of published.
- Uploads go to a temporary folder.

Run from backend/:  pytest
"""

import os
import uuid

# Point the app at the test database BEFORE any app module is imported
from app.config.settings import settings as _settings  # noqa: E402

_BASE_URL, _DB_NAME = _settings.DATABASE_URL.rsplit("/", 1)
TEST_DB_NAME = f"{_DB_NAME.split('?')[0]}_test"
os.environ["DATABASE_URL"] = f"{_BASE_URL}/{TEST_DB_NAME}"
_settings.DATABASE_URL = os.environ["DATABASE_URL"]

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

from app.db import session as db_session  # noqa: E402
from app.main import app  # noqa: E402

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASSWORD = "Passw0rd!23"


def _admin_engine():
    sync_base = _BASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
    return create_engine(f"{sync_base}/postgres", isolation_level="AUTOCOMMIT")


@pytest.fixture(scope="session", autouse=True)
def test_database():
    admin = _admin_engine()
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{TEST_DB_NAME}" WITH (FORCE)'))
        conn.execute(text(f'CREATE DATABASE "{TEST_DB_NAME}"'))

    command.upgrade(Config(os.path.join(BACKEND_DIR, "alembic.ini")), "head")
    yield

    admin.dispose()
    admin = _admin_engine()
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{TEST_DB_NAME}" WITH (FORCE)'))
    admin.dispose()


@pytest.fixture(autouse=True)
async def _fresh_connections():
    """Each test runs on its own event loop; don't reuse pooled connections across loops."""
    yield
    await db_session.engine.dispose()


@pytest.fixture(autouse=True)
def events(monkeypatch):
    """Captures what would be published over WebSockets: list of (user_ids, payload)."""
    captured = []

    async def fake_publish_users(user_ids, payload):
        captured.append((list(user_ids), payload))

    import app.api.v1.chat as chat_api
    import app.api.v1.expenses as expenses_api
    import app.api.v1.groups as groups_api
    import app.api.v1.messages as messages_api
    import app.api.v1.receipts as receipts_api
    import app.websocket.routes as ws_routes
    for module in (chat_api, expenses_api, groups_api, messages_api, receipts_api, ws_routes):
        monkeypatch.setattr(module, "publish_users", fake_publish_users)
    return captured


@pytest.fixture(autouse=True)
def upload_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(_settings, "UPLOAD_DIR", str(tmp_path / "uploads"))
    return tmp_path / "uploads"


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def db():
    async with db_session.async_session_maker() as session:
        yield session


class TestUser:
    def __init__(self, data: dict, tokens: dict):
        self.id = data["id"]
        self.username = data["username"]
        self.email = data["email"]
        self.access_token = tokens["access_token"]
        self.refresh_token = tokens["refresh_token"]

    @property
    def headers(self):
        return {"Authorization": f"Bearer {self.access_token}"}


@pytest.fixture(autouse=True)
def sent_codes(monkeypatch):
    """Verification codes that would have been emailed: {email: latest code}."""
    codes = {}

    def fake_send(to_email, username, code):
        codes[to_email] = code
        return True

    from app.api.v1 import auth as auth_api
    monkeypatch.setattr(auth_api.email_service, "send_verification_code", fake_send)
    return codes


@pytest.fixture
def make_user(client, sent_codes):
    """Register, verify the email with the emailed code, and log in a new user with a unique name."""
    async def _make(prefix: str = "user") -> TestUser:
        username = f"{prefix}_{uuid.uuid4().hex[:8]}"
        email = f"{username}@example.com"
        r = await client.post("/api/v1/auth/register", json={"username": username, "email": email, "password": PASSWORD})
        assert r.status_code == 201, r.text
        r = await client.post("/api/v1/auth/verify-email", json={"identifier": email, "code": sent_codes[email]})
        assert r.status_code == 200, r.text
        r = await client.post("/api/v1/auth/login", json={"identifier": username, "password": PASSWORD})
        assert r.status_code == 200, r.text
        me = (await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {r.json()['data']['access_token']}"})).json()["data"]
        return TestUser(me, r.json()["data"])
    return _make


@pytest.fixture
def make_dm(client):
    async def _make(a: TestUser, b: TestUser) -> str:
        r = await client.post("/api/v1/conversations", json={"kind": "dm", "participant_ids": [b.id]}, headers=a.headers)
        assert r.status_code == 200, r.text
        return r.json()["data"]["id"]
    return _make


@pytest.fixture
def make_group(client):
    async def _make(owner: TestUser, members: list, title: str = "Test group") -> str:
        r = await client.post(
            "/api/v1/conversations",
            json={"kind": "group", "title": title, "participant_ids": [m.id for m in members]},
            headers=owner.headers,
        )
        assert r.status_code == 200, r.text
        return r.json()["data"]["id"]
    return _make


@pytest.fixture
def add_message(db):
    """Insert a message directly (normally the worker persists WebSocket messages)."""
    from datetime import datetime, timedelta, timezone
    from app.models.message import Message, MessageType

    counter = {"n": 0}

    async def _add(conversation_id: str, sender: TestUser, text: str = "hello", **fields) -> str:
        counter["n"] += 1
        message = Message(
            id=uuid.uuid4(),
            conversation_id=uuid.UUID(conversation_id),
            sender_id=uuid.UUID(sender.id),
            text=text,
            message_type=fields.pop("message_type", MessageType.TEXT),
            # strictly increasing timestamps keep ordering deterministic
            created_at=datetime.now(timezone.utc) + timedelta(milliseconds=counter["n"]),
            **fields,
        )
        db.add(message)
        await db.commit()
        return str(message.id)
    return _add
