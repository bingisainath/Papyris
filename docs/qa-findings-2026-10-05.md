# QA findings — messages, images, videos (2026-10-05)

How this was tested: the full stack ran locally (Postgres 16, Redis 7, FastAPI backend, `app.worker`, CRA dev server). Two real Chromium sessions (`alice`, `bob`) were driven through the UI with Playwright. Every HTTP request/response to `:8000`, every WebSocket frame, console errors, dialogs, and screenshots were recorded. DB rows were checked after each run.

Severity: **P0** = feature broken, **P1** = wrong data or behavior users will hit, **P2** = UX/polish/perf.

> **Status (branch `fix/media-messaging-presence`):** fixed and verified in the browser: M1–M14 (Cloudinary was removed; media is now stored on the backend's local disk under `backend/uploads/` and served from `/api/v1/media/…`), T1–T5, T7, T8, T11, W1, W2, W6, U1–U5. Also fixed: `localStorage.userId` was never set by the active login flow, which broke own-message detection. Still open: T6 is mitigated (read receipts wait for the worker), T9, T10, W3–W5, U6–U9, and the section 5 setup notes.

---

## 1. Images & videos (media messages): not implemented end-to-end

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| M1 | P0 | Picking an image/video/PDF sends `{"type":"message","text":""}` over WS. The server replies `{"type":"error","message":"Empty message"}`. No upload happens and nothing reaches Cloudinary. | `web/src/components/organisms/ChatWindow/index.tsx` `handleSendMessage` ignores `file` and calls `sendMessage(conversationId, text)` |
| M2 | P0 | `uploadFile()` (Cloudinary) is never imported or called anywhere. | `web/src/helper/uploadFile.ts` |
| M3 | P1 | Each failed attachment leaves an **empty bubble** in the sender's chat (an optimistic `temp-` message that never gets replaced or removed). The receiver sees nothing. | `web/src/redux/actions/websocketActions.ts` `sendMessage` (no failure/rollback path) |
| M4 | P2 | `Home` has its own `handleSendMessage` that shows `alert('File upload coming soon!')`, but it's dead code: `ChatWindow` doesn't use the `onSendMessage` prop. | `web/src/pages/Home/index.tsx:232` |
| M5 | P0 | The WS service/action API has no media params: `sendMessage(conversationId, text)` only. | `web/src/services/websocket.service.ts:200`, `hooks/useWebSocket.ts:238` |
| M6 | P0 | Backend WS `message` handler only reads `text`. A raw frame with `mediaUrl`/`mediaType`/`messageType` is accepted, but those fields are **dropped** from the broadcast payload. | `backend/app/websocket/routes.py` (`event_type == "message"`) |
| M7 | P0 | Backend rejects media-only messages (empty caption) with "Empty message". | same |
| M8 | P0 | Worker persists only `text`. `message_type` is always `TEXT` and `media_url` is always NULL in the DB. The worker also drops (acks as invalid) any message with empty `text`. | `backend/app/worker.py` `process_message` |
| M9 | P0 | `GET /conversations/{id}/messages` returns no `message_type`/`media_type`/`media_url`/thumbnail/filename fields. The frontend maps `msg.media_url`/`msg.media_type`, which are always undefined. | `backend/app/api/v1/chat.py` `get_messages`; `web/src/redux/actions/chatActions.ts:109` |
| M10 | P1 | `lastMessage` in the conversation list is `last_message.text`, so a media-only message would show a blank preview (should show "📷 Photo" / "🎥 Video"). | `chat.py` `get_conversations` |
| M11 | P1 | Cloudinary config: `REACT_APP_CLOUDINARY_CLOUD_NAME` isn't documented anywhere (URL becomes `/v1_1/undefined/...`). The unsigned upload preset `gusa-gusa-file` is hard-coded. There's no client-side size/type check (backend `MAX_UPLOAD_SIZE` is unused), no progress, no error handling (`response.ok` never checked), and `console.log` of the full response. | `uploadFile.ts` |
| M12 | P2 | `UploadPreview` exists but isn't wired in. There's no preview/caption step before sending. | `web/src/components/molecules/UploadPreview` |
| M13 | P2 | `MessageBubble` "file" type renders a generic "File attachment" with no filename and no link to open/download. | `MessageBubble/index.tsx` |
| M14 | P2 | Server doesn't validate `mediaUrl` (no allowed-host check), so any URL a client sends would be stored and rendered once M6/M8 are fixed. | design note for the fix |

**Evidence (WS log):**
```
alice ws.send  {"type":"message","roomId":"de1b…","text":""}        ← after choosing test.png
alice ws.recv  {"type":"error","message":"Empty message"}
alice ws.send  {"type":"message",…,"text":"caption with image","messageType":"image","mediaType":"image","mediaUrl":"https://example.com/a.png"}
bob   ws.recv  {"type":"message",…,"text":"caption with image","timestamp":…,"status":"sent"}   ← no mediaUrl/mediaType
DB:  caption with image | message_type=TEXT | media_url=NULL
```

---

## 2. Text messages

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| T1 | P1 | **Optimistic message replacement is wrong.** Only one global `window.__lastTempMessageId` exists, and *any* incoming `message` event (including one from the other user, or an echo of an older message) replaces it. When 3 messages were sent quickly, alice's view showed `rapid 1` twice, one of them rendered as a **received** (left-side) bubble. Bob's view was correct. The fix is to send a `clientId` with each message, have the server echo it back, and match on that. | `websocketActions.ts` `sendMessage` and the `on('message')` handler |
| T2 | P1 | **History pagination returns the oldest messages.** `order_by(created_at.asc()).limit(50).offset(0)`: with 62 messages, the API returned messages 1–50, and the newest 12 never showed. The UI also has no "load older" control. | `chat.py` `get_messages` |
| T3 | P1 | **Read receipts never happen.** The UI never sends a WS `read` event (0 frames in the whole session). The `ChatWindow` "mark as read" effect returns before calling `markAsRead`. All `message_receipts` stay `DELIVERED` with `read_at=NULL`, and sender ticks stay a single ✓ forever. | `ChatWindow/index.tsx` mark-read `useEffect` |
| T4 | P1 | **Unread count is wrong for messages seen live.** Alice was in the open DM when bob sent "Hi Alice, bob here", yet it later counted as unread (badge "2"). `last_read_message_id` only moves when you click a conversation that already has `unreadCount > 0`. | `Home/index.tsx` `handleSelectConversation`, plus T3 |
| T5 | P1 | Message status is hard-coded: REST returns `"status": "delivered"` for every message, and WS sends `"sent"`. Neither reflects `message_receipts`. | `chat.py` `get_messages`, `routes.py` |
| T6 | P1 | Race: the WS broadcast happens *before* the worker persists the message. A `read`/`mark-read` that arrives right away can reference a message that isn't in the DB yet. `_mark_read` would then hit an FK error, and `mark-read` could miss the newest message. | `routes.py` + `worker.py` |
| T7 | P1 | `conversations.updated_at` is never bumped when a message arrives, but `GET /conversations` orders by it. The frontend re-sorts by `lastMessageTime`, which hides this, but the server order is wrong. | `chat.py` / `worker.py` |
| T8 | P2 | WS payload `timestamp` (gateway time) differs from DB `created_at` (worker insert time), so a message's time can shift after reload. | `routes.py`, `models/message.py` |
| T9 | P2 | Every incoming message triggers a full `GET /conversations` refetch, sometimes 2× per client per message (see the log around t=30s). | frontend message handler |
| T10 | P2 | `GET /conversations` and `GET /messages` have N+1 queries (per-conversation member, last-message, unread, and other-user queries; per-message sender query). `print()` debug logging runs on every request. | `chat.py` |
| T11 | P2 | Optimistic message uses `localStorage.getItem('username') \|\| 'User'`, but nothing sets that key. | `websocketActions.ts:115` |

---

## 3. WebSocket / presence

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| W1 | P1 | **Closing any one socket marks the user offline everywhere**, even if they still have other tabs/sockets open. Seen when a second alice socket closed: bob got `{"type":"offline","userId":alice}` while alice's main tab was still connected. `srem` on the online set has the same problem. | `routes.py` `finally:` block |
| W2 | P1 | No initial presence snapshot. A new client only learns about users who connect *after* it. `papyris:online_users` is written but never read or sent. The desktop header showed bob as **"Offline"** while bob was connected, and the mobile session showed "Online". Root cause **not fully confirmed**; investigate together with W1. | `routes.py`, `websocketSlice.ts` |
| W3 | P2 | `online` is broadcast to *every* connected user (not just contacts), and on connect it's also sent back to the user themselves. | `routes.py` |
| W4 | P2 | Opening a chat sends `join, join, leave, join` (4 frames) every time. | `useConversationRoom` / `ChatWindow` effects |
| W5 | P2 | On page reload, `join` is attempted before the socket is open (`⚠️ Failed to join … not connected`). The join is retried later, but the console is noisy. | `websocket.service.ts` |
| W6 | P2 | The `message` event is fanned out to members' *user* sockets directly, while `typing`/`read` go through Redis pub/sub rooms. With more than one backend instance, messages won't reach users connected to another instance. | `routes.py` |

---

## 4. Auth / general UI

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| U1 | P1 | Without `web/.env`, `REACT_APP_API_BASE_URL` is undefined, and login POSTs to `http://localhost:3000/api/v1/auth/login` (the dev server). That returns 404, which the UI shows as **"User not found. Please register first."**, which is misleading. Two other clients default to `http://localhost:8000…` (`chat.service.ts`, `auth.service.ts`, `user.service.ts`), so the config is inconsistent. Add a `.env.example` and one default. | `web/src/utils/axios.ts`, `utils/apiError.ts:58` |
| U2 | P2 | Pressing **Enter** on the login form does nothing; you have to click the button. The `<form>` has no `onSubmit`, and the button is `type="button"`. | `LoginForm/index.tsx` |
| U3 | P2 | User-search modal says "Use ↑↓ to navigate, Enter to select", but the keys don't work. The `Input` atom doesn't forward `onKeyDown`. | `SearchUserModal/index.tsx:174`, `atoms/Input` |
| U4 | P2 | Chat header avatar shows **"AV"** instead of bob's initials. `ChatWindow` passes `name=` to `Avatar`, which only reads `alt` and so defaults to "Avatar". | `ChatWindow/index.tsx`, `atoms/Avatar` |
| U5 | P2 | **Mobile (390px):** the message input row overflows, so the Send button is cut off, and sent bubbles and the header kebab are clipped at the right edge. | screenshot `alice-12-mobile-chat.png` |
| U6 | P2 | After login the app lands on `/` and `GET /conversations` fires twice. | `Home` effects |
| U7 | P2 | Avatars with no image load from `ui-avatars.com` (third-party request leaks usernames). | `atoms/Avatar` |
| U8 | P2 | `GET /api/v1/users` with no search returns up to 50 users **with emails** to any logged-in user. | `chat.py` `get_users` |
| U9 | P2 | Typing indicator text is "Someone is typing" even in a DM. | `ChatWindow` |

---

## 5. Setup / repo notes found along the way

- `backend/app/config/settings.py` defaults: `DEBUG=True` (SQLAlchemy echoes every query) and a placeholder `JWT_SECRET_KEY`.
- `infra/docker/docker-compose.yml` uses `papyris/papyris`, while `backend/docker-compose.yml` uses `papyris_user/papyris_pass` (Postgres 15). There are two compose files with different creds.
- `README.md` is saved as UTF-16, so it renders with spaces between characters on GitHub and in terminals.
- Pinned deps (`pydantic==2.6.1`, `asyncpg==0.29.0`) don't install on Python 3.13/3.14. Use Python 3.12.

## What worked

- Register / login (API), `/auth/me`, user search, DM creation (deduplicated correctly), text send/receive in real time for both users, worker persistence of text, membership checks on `join`/`message`, typing events, and the unread badge on the conversation list for messages received while outside the chat.

## Suggested fix order

1. **Media pipeline** (M1–M10): send `{text, messageType, mediaUrl, mediaThumbnail, mediaSize, mediaFilename, clientId}` → validate in WS handler (allow empty text when media present, whitelist host) → include in broadcast → persist in worker → return in `get_messages` and `lastMessage` preview.
2. **T1** (clientId-based optimistic replace) — needed anyway for M3 failure handling.
3. **T2** pagination (newest-first + `before` cursor), **T3/T4** read receipts.
4. **W1/W2** presence.
5. UI polish (U1–U9).
