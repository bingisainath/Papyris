# Papyris

Chat & split: real-time messaging (direct chats and groups, photos, videos, files)
with expense splitting planned next.

| Part | Stack |
|------|-------|
| `backend/` | FastAPI, SQLAlchemy (async), PostgreSQL, Redis (pub/sub + streams), Alembic |
| `web/` | React 19, TypeScript, Redux Toolkit, Tailwind |
| `infra/docker/` | Docker Compose for Postgres and Redis |
| `mobile/` | React Native scaffold (not started) |

## How it fits together

- The **web app** talks to the **API** over HTTP and keeps one **WebSocket** open for live events
  (messages, typing, reads, presence, group changes).
- The API puts new messages on a **Redis stream**; the **worker** (`python -m app.worker`) saves
  them to Postgres. Events to clients go through **Redis pub/sub**.
- Uploaded media is stored on disk in `backend/uploads/` and served through expiring signed links.

## Running locally

Needs Docker, Python 3.12 (the backend's pinned packages don't install on 3.13+) and Node 18+.

**1. Postgres and Redis**

```bash
cd infra/docker
docker compose up -d
```

**2. Backend (first time)**

```bash
cd backend
uv venv --python 3.12 venv          # or: python3.12 -m venv venv
source venv/bin/activate
uv pip install -r requirements.txt  # or: pip install -r requirements.txt
```

Create `backend/.env` (credentials match `infra/docker/docker-compose.yml`):

```
DATABASE_URL=postgresql+asyncpg://papyris:papyris@localhost:5432/papyris
REDIS_URL=redis://localhost:6379/0
redis_dsn=redis://localhost:6379/0
JWT_SECRET_KEY=change-me
DEBUG=false
```

Set up the database (run again after pulling schema changes):

```bash
python scripts/create_tables.py
```

**3. Run** (one terminal each)

```bash
# API
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Worker: saves messages. It doesn't auto-reload; restart it after backend changes.
cd backend && source venv/bin/activate
python -m app.worker

# Web app
cd web
npm install
npm start
```

Open http://localhost:3000. The web app uses `http://localhost:8000` by default; see
`web/.env.example` to change it.

Optional settings in `backend/.env`:

- `LOG_LEVEL` (default `INFO`). `DEBUG` also logs every WebSocket event and worker step.
- `SQL_ECHO=true` logs every SQL statement (very noisy).
- Password-reset emails: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `FROM_EMAIL`, and
  `ENV=production`. With `ENV` unset (local), emails aren't sent; they're printed in the backend
  log so you can open the reset link.

## Database migrations

Schema changes live in `backend/alembic/versions/`.

```bash
cd backend && source venv/bin/activate
alembic revision --autogenerate -m "describe the change"   # after editing app/models
alembic upgrade head                                       # apply
```

`scripts/create_tables.py` runs `alembic upgrade head` for you, and also adopts databases
created before migrations existed (it marks them as being at the baseline revision).

## Tests

```bash
# Backend: creates and drops a temporary <db>_test database on your Postgres
cd backend && source venv/bin/activate
pytest

# Web
cd web
CI=true npm test
```
