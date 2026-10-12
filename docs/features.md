# Papyris features

Last updated October 2026. Papyris is a chat app with built-in expense splitting, for web and
Android (an iOS project exists but hasn't been built yet). It's compared here with WhatsApp and
Signal (chat) and Splitwise (expenses).

Status: **Done** · **Next** (planned) · **Consider** (worth deciding on).

See also:
- [system-design-and-security.md](system-design-and-security.md): how it's built and secured.
- [expenses-roadmap.md](expenses-roadmap.md): expense ideas in detail.

---

## 1. Accounts and devices

| Feature | Status | Notes |
|---|---|---|
| Sign up with username, email and password; email verified with a 6-digit code | Done | |
| Log in with username or email; forgot or reset password | Done | |
| Profile: name, about, username, photo; payment details (Revolut, PayPal.me, UPI) | Done | Payment details power the "Pay" button. |
| Linked devices: link a phone or browser by QR code or 16-character code, with history transfer | Done | Like WhatsApp and Signal linked devices. |
| Sessions: see every signed-in device and log one out remotely | Done | |
| Encrypted backup with a 64-digit recovery key, and restore | Done | |
| Warning before logging out of your only device | Done | |
| Delete my account; download my data | Next | Required by app stores and GDPR. |
| Two-step PIN | Consider | WhatsApp and Signal have it. |

## 2. Chats

| Feature | Status | Notes |
|---|---|---|
| Direct chats and groups | Done | |
| Groups: create, rename, photo, description, add or remove members, make admin, leave (admin-only changes) | Done | Each change posts a note in the chat. |
| Text messages with reply, edit, delete and forward | Done | |
| Photos (with albums), videos (server-made poster frame), voice notes, files | Done | Thin even frame sized to the photo. |
| Reactions | Done | |
| Pin chats | Done | |
| Typing indicator, online status, read receipts, unread badges | Done | |
| "Media, links and docs" view per chat | Done | |
| Push notifications (Android) | Done | Encrypted messages only say "New message" or "Photo". |
| End-to-end encryption for messages and media (Signal protocol design) | Done | See the security document. |
| Security codes, QR verification, "security code changed" notices | Done | |
| Mute a chat (8 hours, 1 week, always); archive a chat | Done | Muted chats send no notifications and don't count in unread totals; archived chats stay archived when messages arrive (WhatsApp's default). |
| Search in messages (all chats, or inside one chat), jumping to the message | Done | Encrypted chats are searched on the device in its encrypted database, as Signal does; the server searches only chats it can read. Old version 1 encrypted messages aren't searchable. |
| Block and report | Next | Needed before going public. |
| Disappearing messages | Consider | WhatsApp and Signal have them. |
| Voice and video calls | Consider | A big project (WebRTC plus TURN servers). |
| Stickers, GIFs, polls, location sharing | Consider | |
| Message requests from strangers | Consider | Signal has these. |

## 3. Expenses

| Feature | Status | Notes |
|---|---|---|
| Add an expense in any chat: equal, exact, percentage or shares split; several payers; categories; dates | Done | Splitwise's core features. |
| Scan a receipt with AI (Claude or OpenAI), item by item | Done | Splitwise charges for this (Pro). |
| Discounts, deals ("3 for 2", shared per item or by price), tax and fees handled; store-specific reading rules (Tesco, Lidl, Aldi…) | Done | |
| Edit every line and discount by hand; the receipt total must match before saving | Done | |
| Your own store discounts (e.g. staff discount) | Done | |
| AI model choice, your own API keys, monthly free scan limit | Done | |
| Several currencies per chat | Done | |
| Balances with optional "simplify debts"; settle up (record payments) | Done | |
| Per chat: You, Balances, Summary (by category, member, month) and History tabs with filters | Done | Splitwise charges for charts and search. |
| Edit, delete, restore and lock expenses, with change history | Done | |
| Excel export: summary, every item and who pays what, discounts | Done | |
| Overall totals across every chat, per person | Done | Splitwise's "friends" view. |
| Remind someone who owes you (once a day) | Done | |
| Pay with Revolut, PayPal or UPI (amount filled in where possible) | Done | Papyris never moves money. |
| Recurring expenses (rent, bills) | Next | Free in Splitwise. |
| Default split per group | Next | Splitwise Pro. |
| "Adjustment" split, search, charts, comments on expenses, currency conversion, trip mode, budgets, offline adding | Consider | Details in [expenses-roadmap.md](expenses-roadmap.md). |

## 4. Settings and app

| Feature | Status | Notes |
|---|---|---|
| Linked devices, Sessions, Encrypted backup | Done | |
| Notifications on or off | Done | |
| Receipt scanning settings and store discounts | Done | |
| App-styled dialogs on the phone; Android back button handled correctly | Done | |
| Dark mode | Consider | |
| Languages (translations) | Consider | Splitwise supports 7+. |
| iOS app | Next | The project exists but hasn't been built or tested. |
| Desktop app | Consider | It would also make web encryption trustworthy (signed code). |

## 5. Suggested order for what's next

1. Before going public: block and report, delete account and download data, rate limits, production
   setup (see the checklist in the security document).
2. Expenses: recurring expenses, default splits.
3. iOS build.
4. Then: disappearing messages, polls, calls, desktop app, as people ask for them.
