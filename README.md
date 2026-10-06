# Papyris

Chat & split: real-time messaging (direct chats and groups, photos, videos, files) and
shared expenses: add a bill by hand or photograph the receipt, and AI reads the items so the
group can tap who each item is for.

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
- **Expenses** are stored as whole cents (never floats) per currency. A receipt photo is read by an
  AI model (Claude by default) in a background task; the AI only transcribes the receipt, and
  `app/services/split_engine.py` does all the maths. Balances are always recalculated from the
  expenses and payments, never stored.

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

### Receipt scanning (optional)

Without a key everything else works, including manual expenses. To read receipts with AI, add
to `backend/.env`:

```
ANTHROPIC_API_KEY=sk-ant-...        # https://console.anthropic.com/settings/keys
# OPENAI_API_KEY=sk-...             # only if you enable OpenAI models
AI_KEY_ENCRYPTION_SECRET=<long random string>   # encrypts keys people add themselves
```

- Keys live only on the server. The web app never sees them, and nothing in the app can change them.
- Each person gets a monthly number of free scans on the server's key (default 50). People can
  add their own Claude or OpenAI key in Settings for unlimited scans billed to them; those keys are
  stored encrypted and only the last 4 characters are ever shown again.
- Set a spending limit for the key in the Anthropic Console as a safety net.
- Keep `AI_KEY_ENCRYPTION_SECRET` stable: if it changes, saved personal keys can't be decrypted
  and people need to add them again.

App admins choose which models are offered, the default model (Claude Opus 5 out of the box) and
the monthly scan limit, in Settings. Only someone with server access can make an admin:

```bash
cd backend && source venv/bin/activate
python scripts/make_admin.py <username>            # --revoke to undo
```

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

Browser test for expenses and receipts (needs Playwright, `pip install playwright && playwright
install chromium`, plus the QA users `qa_alice`, `qa_bob` and `qa_carol` with password
`Passw0rd!23`). It runs the backend with a fake receipt reader, so no AI key or cost is needed:

```bash
cd backend && source venv/bin/activate && python ../e2e/fake_ai_server.py   # terminal 1
cd web && npm start                                                         # terminal 2
python e2e/expenses_e2e.py /tmp/papyris-shots                               # terminal 3
```

Each run creates an "E2E Flat …" group; delete them afterwards if you like.
