// src/crypto/session.ts
// This browser's unlocked encryption keys.
//
// The keys (created here, or received by linking) are kept in IndexedDB so the next visit has
// them. They're stored wrapped with an AES key that the browser marks non-extractable: page
// scripts can use it, but its bytes can't be read out or copied off the disk as a plain key.
// Logging out deletes them; signing in again means linking this browser again.

import { keysFromSecret, keysToSecret } from './e2e';
import type { KeyPairs } from './e2e';

const DB_NAME = 'papyris-e2e';
const STORE = 'keys';

let current: { userId: string; keys: KeyPairs } | null = null;
const listeners = new Set<() => void>();
const staleListeners = new Set<() => void>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

interface Stored {
  wrapKey: CryptoKey;
  iv: Uint8Array;
  wrapped: ArrayBuffer;
}

export const e2eSession = {
  /** Unlocked keys for the signed-in user, or null (not set up / not unlocked yet). */
  keys(): KeyPairs | null {
    return current?.keys ?? null;
  },

  userId(): string | null {
    return current?.userId ?? null;
  },

  /** Keep the unlocked keys for this user, in memory and (wrapped) in IndexedDB. */
  async set(userId: string, keys: KeyPairs): Promise<void> {
    current = { userId, keys };
    listeners.forEach((l) => l());
    try {
      const wrapKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrapKey, keysToSecret(keys));
      await run('readwrite', (store) => store.put({ wrapKey, iv, wrapped } as Stored, userId));
    } catch {
      // Private browsing may block IndexedDB: the keys still work until the tab closes
    }
  },

  /** Load keys unlocked earlier in this browser. True if found. */
  async restore(userId: string): Promise<boolean> {
    if (current?.userId === userId) return true;
    try {
      const stored = await run<Stored | undefined>('readonly', (store) => store.get(userId));
      if (!stored) return false;
      const secret = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: stored.iv }, stored.wrapKey, stored.wrapped);
      current = { userId, keys: keysFromSecret(new Uint8Array(secret)) };
      listeners.forEach((l) => l());
      return true;
    } catch {
      return false;
    }
  },

  /** Forget the keys on this browser (logout). */
  async clear(): Promise<void> {
    current = null;
    listeners.forEach((l) => l());
    try {
      await run('readwrite', (store) => store.clear());
    } catch {
      // nothing stored
    }
  },

  /** Our keys were reset on another device: the app asks to unlock again (see E2EGate). */
  reportStale(): void {
    staleListeners.forEach((l) => l());
  },

  onStale(listener: () => void): () => void {
    staleListeners.add(listener);
    return () => {
      staleListeners.delete(listener);
    };
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
