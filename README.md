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
- Uploaded media is stored on disk in `backend/uploads/`, **encrypted** (AES-256-GCM, in chunks so
  videos can still seek), and served through expiring signed links to chat members only.
  Photos are shrunk in the browser (1600 px, or 4096 px with HD) and always lose their location
  and camera data on the server. Videos are compressed to 720p MP4 with the ffmpeg bundled in the
  `imageio-ffmpeg` package (no system install). "Document" sends files at original quality.
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
- Email (sign-up codes and password resets): `SMTP_USER`, `SMTP_PASSWORD`, and optionally
  `SMTP_HOST` (default smtp.gmail.com), `SMTP_PORT` (587), `FROM_EMAIL`, `FRONTEND_URL`. With
  SMTP set, emails are really sent. Without it, they're written to the backend log instead (look
  for `EMAIL NOT SENT`) so you can copy the code or link while developing. For Gmail, use an
  App Password (Google Account → Security → 2-Step Verification → App passwords).

### Media encryption key

Uploaded files are encrypted on disk. Set your own key in `backend/.env` (keep a copy somewhere
safe: files can't be read without it):

```bash
python -c "import secrets,base64;print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"
# MEDIA_ENCRYPTION_KEY=<the output>
```

Without it, a key is derived from `JWT_SECRET_KEY`. Files saved that way stay readable after you
set `MEDIA_ENCRYPTION_KEY`. To encrypt files uploaded before encryption existed:

```bash
cd backend && source venv/bin/activate
python scripts/encrypt_media.py --dry-run   # count
python scripts/encrypt_media.py             # encrypt (safe to run again)
```

### End-to-end encryption

Messages, photos, videos, voice notes and documents are end-to-end encrypted in chats where every
member has set up encryption. The server stores and forwards them but can't read them.

- **Keys.** Nothing is asked at sign-up. The first device creates an X25519 key (encryption) and
  an Ed25519 key (signing) and only publishes the public halves. Private keys never reach the
  server. They stay on the device (Keychain/Keystore on phones, IndexedDB in browsers) until logout.
- **Linking another device (like WhatsApp Web).** A new phone or browser shows a QR code and a
  16-character code. On a signed-in device, go to Settings → End-to-end encryption → **Link a
  device**, then scan the QR (phone camera) or type the code. That device sends the keys encrypted
  for a one-off key of the new device, so the server only relays them.
  - The QR carries that one-off key, so the server can't swap it.
  - A typed code is checked against the key's fingerprint (80 bits).
  - Requests expire after 10 minutes and only work within one account.
- **Messages.** Each message is encrypted once with a fresh key (XChaCha20-Poly1305). That key is
  sealed separately for every member, the sender included. The sender also signs the message, so
  the server can't alter it, move it to another chat or forge a sender. Edits and forwards are new
  encrypted copies.
- **Files.** Files are encrypted on the device in 64 KiB chunks with their own random key, which
  travels inside the encrypted message. The server keeps opaque `.enc` files and can't compress
  them or make previews, so the apps resize photos, strip photo metadata and make video posters
  themselves.
- **Not encrypted.**
  - Expenses and receipt scans: the server calculates balances and reads receipts.
  - Group names, descriptions and photos, and profiles.
  - Who talks to whom and when.
  - Messages sent before encryption existed.
  - Chats with someone who hasn't set up encryption: the chat says so, and it switches over once
    everyone has.
- **Notifications.** Push notifications say "New message" (or "Photo", etc.), never the text.
- **No other device to hand.** "Start fresh" creates new keys. Older encrypted messages can't be
  read with them, and contacts' apps notice the new key.
- **Encrypted backup (optional).** Settings → Encrypted backup shows a 64-digit recovery key once.
  The backup holds the encryption keys (and, with v2, the chat history). It's encrypted on the
  device with a fresh key each time, sealed with a key derived from the recovery key, and replaced
  daily by devices that have the key. With every device gone, the link screen offers "Restore from
  your backup". The server can't open it, and logging out of the last device warns first.
- **Security code.** Chat info → "Verify security code" shows 60 digits. Two people who see the
  same code know the server didn't swap their keys.
- **Code.** The core (`src/crypto/e2e.ts`) and the message logic (`src/crypto/messages.ts`) are
  shared word for word by the web and phone apps. Check with `npm run check:e2e` in either app.
  The libraries are @noble/curves, @noble/ciphers and @noble/hashes.

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
python e2e/media_e2e.py /tmp/papyris-shots                                  # photos, videos, voice notes
python e2e/encryption_e2e.py /tmp/papyris-shots                             # end-to-end encryption
```

The media and encryption tests also need the worker (`python -m app.worker`) running. `encryption_e2e.py` resets the QA
users' keys at the start (it also needs `pip install psycopg2-binary` and the database at
`PAPYRIS_DB`). The other tests start fresh when a browser is asked to link.

Each run creates an "E2E Flat …" group; delete them afterwards if you like.
