// src/utils/drafts.ts
// Unsent text per chat, so leaving a chat or closing the app doesn't lose it. Kept on this phone
// only, in its own SQLCipher-encrypted database (same protection as the decrypted messages), and
// wiped on logout.

import { openSqliteKV } from '../crypto/v2-platform/sqliteKV';
import type { KV } from '../crypto/v2/storage';

let db: Promise<KV> | null = null;
const store = () => (db ??= openSqliteKV('shareeven-drafts.sqlite'));
const key = (conversationId: string) => `draft:${conversationId}`;

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const chatDrafts = {
  async get(conversationId: string): Promise<string> {
    try {
      return (await (await store()).get(key(conversationId))) || '';
    } catch {
      return '';
    }
  },

  /** Saved shortly after typing stops (not on every keystroke). */
  set(conversationId: string, text: string): void {
    const pending = timers.get(conversationId);
    if (pending) clearTimeout(pending);
    timers.set(conversationId, setTimeout(() => {
      timers.delete(conversationId);
      store().then((kv) => kv.write([[key(conversationId), text.trim() ? text : null]])).catch(() => undefined);
    }, 400));
  },

  /** Sent: forget it now. */
  clear(conversationId: string): void {
    const pending = timers.get(conversationId);
    if (pending) clearTimeout(pending);
    timers.delete(conversationId);
    store().then((kv) => kv.write([[key(conversationId), null]])).catch(() => undefined);
  },

  /** Logout / account deleted. */
  async clearAll(): Promise<void> {
    timers.forEach(clearTimeout);
    timers.clear();
    try {
      await (await store()).clear();
    } catch {
      // nothing saved yet
    }
  },
};
