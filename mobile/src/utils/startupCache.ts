// src/utils/startupCache.ts
// What the app needs to draw its first screen without waiting for the server: the signed-in user,
// whether this phone's encryption was set up, and the chat list (with its decrypted previews).
// Shown at once on start and refreshed from the server straight after. Kept on this phone only, in
// its own SQLCipher-encrypted database (like drafts), and wiped on logout.

import { openSqliteKV } from '../crypto/v2-platform/sqliteKV';
import type { KV } from '../crypto/v2/storage';
import type { User } from '../api/auth';
import type { Conversation } from '../api/chat';

let db: Promise<KV> | null = null;
const store = () => (db ??= openSqliteKV('shareeven-cache.sqlite'));

async function read<T>(key: string): Promise<T | null> {
  try {
    const value = await (await store()).get(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  store().then((kv) => kv.write([[key, value == null ? null : JSON.stringify(value)]])).catch(() => undefined);
}

export const startupCache = {
  user: () => read<User>('user'),
  setUser: (user: User) => write('user', user),

  /** This phone finished the encryption check before (so the app can open without waiting for it). */
  encryptionReady: async (userId: string) => !!(await read<boolean>(`e2eReady:${userId}`)),
  setEncryptionReady: (userId: string, ready: boolean) => write(`e2eReady:${userId}`, ready || null),

  chats: (userId: string) => read<Conversation[]>(`chats:${userId}`),
  setChats: (userId: string, conversations: Conversation[]) => write(`chats:${userId}`, conversations),

  /** Logout / account deleted. */
  async clear(): Promise<void> {
    try {
      await (await store()).clear();
    } catch {
      // nothing saved yet
    }
  },
};
