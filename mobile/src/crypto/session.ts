// src/crypto/session.ts
// This phone's unlocked encryption keys (same interface as web/src/crypto/session.ts).
//
// The private keys (created here, or received by linking) are kept in the phone's secure storage
// (Android Keystore / iOS Keychain), readable only by Papyris on this device. Logging out deletes
// them; signing in again means linking this phone again.

import * as Keychain from 'react-native-keychain';
import { fromBase64, keysFromSecret, keysToSecret, toBase64 } from './e2e';
import type { KeyPairs } from './e2e';

const service = (userId: string) => `app.papyris.e2e.${userId}`;

let current: { userId: string; keys: KeyPairs } | null = null;
const listeners = new Set<() => void>();
const staleListeners = new Set<() => void>();

export const e2eSession = {
  /** Unlocked keys for the signed-in user, or null (not set up / not unlocked yet). */
  keys(): KeyPairs | null {
    return current?.keys ?? null;
  },

  userId(): string | null {
    return current?.userId ?? null;
  },

  async set(userId: string, keys: KeyPairs): Promise<void> {
    current = { userId, keys };
    listeners.forEach((l) => l());
    await Keychain.setGenericPassword('e2e', toBase64(keysToSecret(keys)), {
      service: service(userId),
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    }).catch(() => undefined);
  },

  /** Load keys unlocked earlier on this phone. True if found. */
  async restore(userId: string): Promise<boolean> {
    if (current?.userId === userId) return true;
    try {
      const saved = await Keychain.getGenericPassword({ service: service(userId) });
      if (!saved) return false;
      current = { userId, keys: keysFromSecret(fromBase64(saved.password)) };
      listeners.forEach((l) => l());
      return true;
    } catch {
      return false;
    }
  },

  /** Forget the keys on this phone (logout). */
  async clear(): Promise<void> {
    const userId = current?.userId;
    current = null;
    listeners.forEach((l) => l());
    if (userId) await Keychain.resetGenericPassword({ service: service(userId) }).catch(() => undefined);
  },

  /** Our keys were reset on another device: the app asks to unlock again. */
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
