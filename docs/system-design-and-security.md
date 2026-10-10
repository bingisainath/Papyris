# Papyris: system design and security

Last updated October 2026 (branch `feature/e2e-v2`). Each topic says what Papyris does today, how
WhatsApp, Signal and Splitwise handle the same thing, and whether it's **Done**, **Next** (planned) or
**Before production** (must be done before real users).

Related documents:
- [encryption-design-v2.md](encryption-design-v2.md): full encryption design.
- [encryption-review-brief.md](encryption-review-brief.md): brief for an outside security review.
- [features.md](features.md): what the app does.
- [expenses-roadmap.md](expenses-roadmap.md): expense ideas.

---

## 1. Architecture at a glance

```text
 Web app (React)          Phone app (React Native 0.82, Android; iOS project not yet built)
      \                         /
       \   HTTPS + WebSocket   /
        v                     v
   FastAPI (Python 3.12, async)  -- REST under /api/v1, WebSocket /api/v1/ws/chat
        |            |        \
   PostgreSQL     Redis        Media files on local disk (backend/uploads), encrypted at rest
   (all data)     (pub/sub,       \
                  message stream,  Firebase Cloud Messaging (push), email (verification, reset),
                  presence,        AI receipt readers (Anthropic, OpenAI)
                  reminder limits)
        |
   Worker (python -m app.worker): saves chat messages from the Redis stream, sends push notifications
```

| Topic | Papyris today | WhatsApp / Signal / Splitwise | Status |
|---|---|---|---|
| Real-time delivery | WebSocket per device. Messages go to Redis pub/sub at once, are saved by the worker from a Redis stream, and are pushed to offline phones. | WhatsApp: custom XMPP-based protocol (Erlang). Signal: WebSocket plus push. Splitwise: REST with polling and push. | Done |
| Ordering and duplicates | The server sets each message's id and timestamp; the apps keep a client id until the server confirms. Encrypted packets have replay guards. | Same idea in all of them. | Done |
| Encrypted message delivery | Per-device mailboxes. Packets are deleted once the device acknowledges them; the timeline row holds only a marker. | Signal and WhatsApp: per-device queues, deleted after delivery. | Done |
| Media | Uploaded to the backend, encrypted at rest (AES-256-GCM in chunks, so videos can seek). Served through expiring signed links. Videos get a poster frame made on the server. End-to-end encrypted media is opaque to the server (PMV2 format). | WhatsApp and Signal: encrypted blobs on a CDN, the key inside the message. | Done (move to object storage: Before production) |
| Money maths | Integer minor units (cents), largest-remainder rounding, each person rounded once. Balances worked out from expenses and payments on every request. | Splitwise: the same principles; it also caches balances. | Done (caching: Next if slow) |
| Scaling | One API process, one worker, one Postgres, one Redis. | All three run large server fleets with sharded storage. | Before production: several API instances behind a load balancer; managed Postgres and Redis |

## 2. Accounts and sign-in

| Topic | Papyris today | Real apps | Status |
|---|---|---|---|
| Identity | Username or email plus password. The email is verified with a 6-digit code (5 tries, resend wait). | WhatsApp and Signal: phone number plus SMS code (Signal adds a PIN). Splitwise: email plus password or Google/Apple sign-in. | Done |
| Passwords | bcrypt hashes; changing the password invalidates refresh tokens. Reset by emailed link. | Splitwise: the same. WhatsApp and Signal have no passwords. | Done |
| Tokens | JWT access token (1 hour) and refresh token (7 days), renewed automatically. | Similar short-lived tokens. | Done |
| Sessions | Every sign-in is a session whose id is inside its tokens. Logging out, or logging a device out from Settings → Sessions, revokes it: API calls, refresh and WebSocket all stop working, and an online device signs out at once and wipes its keys. | WhatsApp, Signal and Splitwise all list linked devices and let you log one out. | Done |
| Device limit | 10 devices per account. Devices that signed in but were never linked are cleaned up after a day idle (or after ~15 minutes when the account is full). | WhatsApp: 4 companion devices. Signal: 5. | Done |
| Brute-force protection | Email codes: 5 tries. There's no rate limit on login, registration or password reset yet. | All of them rate-limit by IP and account. | Before production |
| Two-step login | None. | WhatsApp has a 6-digit two-step PIN; Signal has a registration lock PIN; Splitwise has none. | Next |
| Token storage | Web: localStorage (readable by any script on the page). Phone: Keychain/Keystore. | Signal Desktop and WhatsApp Web keep session keys in local storage too; web is the weak spot. | Before production: a strict Content-Security-Policy; consider httpOnly cookies for web |

## 3. End-to-end encryption

Full detail: [encryption-design-v2.md](encryption-design-v2.md).

| Topic | Papyris today | WhatsApp / Signal | Status |
|---|---|---|---|
| Protocol | X3DH key agreement, Double Ratchet for direct chats, Sender Keys for groups, on X25519, Ed25519, HKDF-SHA256 and ChaCha20-Poly1305 (audited `@noble` libraries). An in-house implementation of the published Signal specs. | Both use the Signal Protocol (libsignal). | Done (outside review: Before production) |
| What's encrypted | Message text, photos, videos, voice notes, files, edits, replies' content. | The same. | Done |
| Not encrypted | Expenses, receipts, balances, group names, photos and descriptions, reactions, who is in which chat, timing, the "contains a link" flag. The server needs these to work out balances and show chats. | WhatsApp: group metadata is visible to the server. Signal: also hides group membership (private groups) and the sender (sealed sender). | Known trade-off |
| Devices | Each device has its own keys, listed in an account-signed device list. Every linked device holds the account key (like Signal). | WhatsApp: the phone is primary and others get certificates. Signal: linked devices share the identity key. | Done |
| Linking | QR code or 16-character code; the approving device sends keys and (optionally) message history encrypted for the new device only. | WhatsApp and Signal: QR linking plus history transfer. | Done |
| Verifying people | 60-digit security code from both account keys, a QR scan to verify, and "security code changed" notices. Sending to a verified contact whose code changed waits until you accept. | Signal: safety numbers and verified status. WhatsApp: security code and change notices. | Done (sync "verified" across own devices: Next) |
| Backups | Optional, encrypted with a 64-digit recovery key that only the user holds; it includes history and the account key. | WhatsApp: optional end-to-end encrypted backup (64-digit key or password). Signal: secure backups with a 64-character key. | Done |
| Local storage | Web: IndexedDB with every value AES-GCM encrypted under a non-extractable key. Phone: SQLCipher, key in Keychain/Keystore. | Similar (Signal: SQLCipher). | Done |
| Old version 1 | Kept only to read older messages; new accounts never get version 1 keys. | n/a | Done (switch off sending completely: Next) |
| Web code trust | The server delivers the web app's code, so a compromised server could serve code that steals keys. | WhatsApp Web: "Code Verify" browser extension. Signal: no web app (desktop app only). | Before production: decide (signed desktop app, or a verification extension) |
| Metadata protection | None beyond padding (messages to 160 bytes, files with Padmé). | Signal: sealed sender, private contact discovery. WhatsApp: limited. | Later |

## 4. Server-side data protection

| Topic | Papyris today | Real apps | Status |
|---|---|---|---|
| Media at rest | AES-256-GCM, key from `MEDIA_ENCRYPTION_KEY`. | All of them encrypt storage. | Done (set a real key and keep it in a secret manager: Before production) |
| Users' own AI keys | Encrypted with Fernet (`AI_KEY_ENCRYPTION_SECRET`); only the last 4 characters are ever shown. The phone and web never see the server's keys. | n/a | Done |
| Payment details | Only usernames (Revolut, PayPal.me, UPI), shown only to people who share a chat with you. Papyris never moves money. | Splitwise: payment integrations through Venmo and PayPal. | Done |
| Access control | Every chat, expense, receipt, file and key request checks membership. Group changes are admin-only. Encryption keys and device lists are only shown to chat partners. | Same principle. | Done (tested) |
| User directory | Search needs 2+ characters and matches username, name or exact email; with no search text it lists only people you already share a chat with. | WhatsApp and Signal: contact discovery by phone number. | Done (review what search results reveal: Next) |
| Database | Postgres in Docker with a dev password. | Managed, encrypted, backed-up databases. | Before production: managed Postgres, encryption at rest, daily backups with restore tests, least-privilege DB user |
| Secrets | `.env` file; defaults include a placeholder `JWT_SECRET_KEY` and `DEBUG=True`. The Firebase service account is kept outside the repo. | Secret managers (Vault, cloud KMS). | Before production: real secrets, `DEBUG=False`, secret manager, key rotation plan |

## 5. Network and API hardening

| Topic | Papyris today | Status |
|---|---|---|
| HTTPS | Not set up (dev runs on http). An nginx config exists in `infra/ngnix`. | Before production: TLS everywhere (HSTS), the WebSocket over wss |
| CORS | Allowed origins come from settings. | Before production: only the real web domain |
| Rate limiting | Only for specific actions: AI scans per month, link requests (5 pending), reminders (1 a day), email codes. | Before production: per-IP and per-account limits on login, register, reset, uploads, messages and WebSocket events |
| Input validation | Pydantic models with lengths and patterns; uploads checked by type and size; signed media links; the "contains a link" flag comes from the sender. | Done |
| Security headers | `nosniff` on media. | Before production: Content-Security-Policy, X-Frame-Options, Referrer-Policy |
| Error handling | One error format; internal errors are logged, not shown to users. | Done |
| Abuse | No blocking, reporting or spam controls. | Next: block a person, report a message or group (WhatsApp, Signal and Splitwise all have these) |

## 6. Reliability and operations

| Topic | Papyris today | Status |
|---|---|---|
| Tests | Backend ~150, web ~125, phone ~110, and browser tests in `e2e/`. Crypto: RFC test vectors, known answers checked against Python, a hostile-network test. | Done |
| CI | None: tests are run by hand. | Before production: run every suite on each push |
| Monitoring | Logs only. | Before production: error tracking (e.g. Sentry), metrics, uptime alerts |
| Worker | One process. If it stops, messages wait in Redis and are saved when it restarts. | Before production: supervised (restart on crash), at least two |
| Migrations | Alembic, 14 so far. | Done (zero-downtime migration practice: Before production) |
| Mobile release | Debug build only; release builds are signed with the debug key; iOS not built. | Before production: release signing, Play Store and App Store builds, crash reporting |
| Data deletion | No "delete my account" yet. | Before production (required by app stores and GDPR) |
| Privacy | No privacy policy or terms. | Before production (GDPR: data export, deletion, retention, processors such as Firebase and the AI providers) |

## 7. Before production: checklist

1. An outside security review of the encryption (brief ready).
2. Real secrets in a secret manager. Set `JWT_SECRET_KEY`, `MEDIA_ENCRYPTION_KEY` and `AI_KEY_ENCRYPTION_SECRET`, and set `DEBUG=False`.
3. HTTPS/WSS, strict CORS, security headers (CSP).
4. Rate limiting and abuse controls (login, sign-up, reset, uploads, messages).
5. Managed Postgres and Redis with backups; media in object storage (S3-compatible) with lifecycle rules.
6. CI running every test suite; error tracking and monitoring; a supervised worker.
7. Android release signing and a Play Store build; iOS build and test.
8. Account deletion, data export, privacy policy and terms.
9. A decision on web code trust (desktop app or verification extension).
10. A load test (messages per second, many devices per account, large groups).
