# Papyris end-to-end encryption: brief for an external review

Status: October 2026, branch `feature/e2e-v2`. The design is in [encryption-design-v2.md](encryption-design-v2.md);
this page says what to review, what we already know is weak, and what we'd like answered.

## 1. What it is

A chat-and-expense-splitting app (web: React; phones: React Native 0.82 with Hermes; server: FastAPI +
Postgres + Redis). Messages, photos, videos, voice notes and files are end-to-end encrypted. Expenses,
receipt scans, balances and group names, photos and descriptions are not (the server needs them).

- **Version 2 (current):** an in-house implementation of the published Signal specifications: X3DH, the
  Double Ratchet (rev. 4) and Sender Keys, on X25519, Ed25519, HKDF-SHA256 and ChaCha20-Poly1305 from the
  audited `@noble` libraries (`curves` 1.9.7, `ciphers` 1.3.0, `hashes` 1.8.0). libsignal wasn't used:
  it's AGPL-licensed and has no supported browser or React Native build.
- **Version 1 (legacy, read mostly):** one X25519 + Ed25519 key pair per account, a fresh
  XChaCha20-Poly1305 key per message wrapped for every member, signed by the sender. No forward secrecy.
  New accounts no longer get version 1 keys; existing ones keep theirs only to read older messages.
  A chat still sends version 1 when some member has version 1 keys but no version 2 device list.

## 2. Scope (about 3,500 lines of TypeScript, shared word for word by the two apps)

| Area | Files |
|---|---|
| Primitives, KDF labels | `web/src/crypto/v2/primitives.ts` |
| Identities, device certificates, signed device lists, safety numbers | `v2/identity.ts`, `v2/trust.ts` |
| Prekeys, X3DH | `v2/prekeys.ts`, `v2/x3dh.ts` |
| Double Ratchet, sessions (transactional commit) | `v2/ratchet.ts`, `v2/session.ts` |
| Sender Keys (groups) | `v2/senderKeys.ts` |
| Message bodies (padding, replay guard), packets | `v2/body.ts`, `v2/packets.ts` |
| Media (PMV2: chunked STREAM, Padmé padding) | `v2/media.ts` |
| Device linking, history transfer, account-key handling | `v2/link.ts`, `v2/accountLink.ts` |
| Sending and receiving, device directory and pinning | `v2/messenger.ts`, `v2/device.ts` |
| Encrypted local storage | `v2/storage.ts`; `web/src/crypto/v2-platform/idbKV.ts` (IndexedDB, AES-GCM, non-extractable key); `mobile/src/crypto/v2-platform/sqliteKV.ts` (SQLCipher, key in Keychain/Keystore) |
| Backups (64-digit recovery key) | `web/src/crypto/backup.ts`, `backupRuntime.ts` |
| Version 1 | `web/src/crypto/e2e.ts`, `messages.ts`, `linking.ts` |
| Server (checks signatures and formats only; never sees private keys) | `backend/app/api/v1/e2e_v2.py`, `e2e_keys.py`, `e2e_backup.py`; `backend/app/services/e2e_v2.py`, `e2e_mailbox.py` |

`npm run check:e2e` (in `web/` or `mobile/`) confirms both apps run identical crypto code.

## 3. Tests you can run

- `web`: `CI=true npx react-scripts test --watchAll=false src/crypto`. These include:
  - RFC 7748/8032/5869/8439 vectors through our wrappers;
  - known answers for our KDFs, computed independently with Python `cryptography`;
  - X3DH and ratchet tests: out of order, replays, forgeries, skipped-key limits, simultaneous starts;
  - a seeded hostile-network test (reordering, loss, duplicates, bit flips) in `v2.test.ts`;
  - Sender Keys rotation, PMV2 tampering and truncation;
  - linking (swapped keys refused), trust (QR verification, key changes).
- `mobile`: `npx jest` runs the same files.
- `backend`: `venv/bin/python -m pytest tests/test_e2e*.py`. This includes a cross-language fixture: a device list signed by the TypeScript code is verified by Python.
- Browser tests in `e2e/`: `encryption_e2e.py`, `v2_messaging_e2e.py`, `backup_e2e.py`, `trust_e2e.py`.

## 4. Known weaknesses and deliberate trade-offs

**The web app**
1. **The server delivers the web app's code.** A compromised or malicious server can serve JavaScript that
   reads keys and messages. This is inherent to browser E2E. There's no code-signing or verification
   extension yet (compare WhatsApp's Code Verify). The phone apps don't have this problem.
2. **Local storage on the web is encrypted against disk copies, not against code running in the page.**
   Any XSS in the app can read everything.

**Accounts and devices**
3. **Every linked device holds the account key** (like Signal, unlike WhatsApp's primary-phone model). It
   travels only inside the link grant, encrypted for the new device. A compromised device can certify
   new devices until it's noticed.
4. **Trust on first use.** Account keys are pinned the first time they're seen. Verification (comparing
   codes or scanning the QR code) is per device and not yet synced between a person's own devices.
5. **Takeover when every listed device has logged out.** If a device with valid version 1 keys finds that
   all devices on the account's list have logged out, it becomes the first device of a fresh list
   without asking. Contacts see a key-change notice.

**Version 1 (legacy)**
6. **No forward secrecy for version 1 messages.** The account key opens every version 1 message, and
   devices keep it to read old messages.

**What the server can see (metadata)**
7. **Who talks to whom, when, and how much.** The server sees:
   - members, timing and message kind (text, photo, video, voice, file);
   - the "contains a link" flag (used for the Links tab);
   - reply-to ids and reactions (emoji, not encrypted);
   - the conversation id inside each packet;
   - device lists, and approximate sizes (bodies padded to 160 bytes, files with Padmé).

   There's no sealed sender.

**Backups and history transfer**
8. **Backups.** The 64-digit recovery key (about 212 bits) goes through HKDF, without a slow KDF, because
   it isn't a password. The backup contains the account key, the version 1 keys and the local message
   database.
9. **History transfer.** One PMV2 file is uploaded with a signed URL valid for 1 to 2 days. Its key is
   only in the link grant. The server deletes the file once the new device reports it has downloaded it.

**Implementation and timing**
10. **Clocks.** "Sent before this device joined" uses the server's clock for both times. The server
    could lie, but that only changes a label.
11. **Randomness.** `crypto.getRandomValues` in browsers; `react-native-get-random-values` on phones.
12. **No formal verification** and no third-party review yet. That's what this brief is for.

## 5. Questions for the reviewer

1. Do X3DH, the ratchet and Sender Keys match the specifications? In particular:
   - associated data;
   - header handling;
   - skipped-key storage limits (1,000);
   - the commit-after-store transaction model.
2. Is sharing the account key with every linked device acceptable here? Would certificate-only
   companions (WhatsApp's model) be worth the extra complexity?
3. Is anything wrong in the link grant? It uses ephemeral-ephemeral X25519 and a zero nonce under a
   single-use key; the QR code carries the identity keys and the typed code is 80 bits.
4. Is any domain separation missing in the KDF labels, the AD or the signatures?
5. PMV2: the chunk nonce construction, the final-chunk flag and random-access decryption.
6. Backups: is HKDF without a slow KDF fine for a 64-digit random key?
7. Is there a practical way to reduce the web code-delivery risk (point 1) for this app?
8. Is version 1 still being sent in mixed chats a meaningful risk, and when should it be switched off
   completely?
