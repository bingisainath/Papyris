// Prekeys (docs/encryption-design-v2.md §2, §4.1): a signed prekey rotated weekly and a batch of
// one-time prekeys, published so others can start a session while this device is offline.

import { b64, CryptoError, KeyPair, newX25519, sign, unb64, verify } from './primitives';
import type { DeviceIdentity } from './identity';

export const SIGNED_PREKEY_ROTATION_MS = 7 * 24 * 3600e3;
export const SIGNED_PREKEY_KEEP_MS = 30 * 24 * 3600e3; // old ones still answer late first messages
export const ONE_TIME_PREKEY_BATCH = 100;
export const ONE_TIME_PREKEY_REFILL_BELOW = 25;

export interface SignedPreKey { id: number; key: KeyPair; sig: Uint8Array; created: number }
export interface OneTimePreKey { id: number; key: KeyPair }

export function newSignedPreKey(identity: DeviceIdentity, id: number, created = Date.now()): SignedPreKey {
  const key = newX25519();
  return { id, key, sig: sign(identity.sign.priv, key.pub), created };
}

export function newOneTimePreKeys(firstId: number, count = ONE_TIME_PREKEY_BATCH): OneTimePreKey[] {
  return Array.from({ length: count }, (_, i) => ({ id: firstId + i, key: newX25519() }));
}

/** What the server hands out for one device (one-time prekey only if any are left). */
export interface PreKeyBundle {
  user: string;
  deviceId: number;
  identitySign: string;
  identityDh: string;
  identityDhSig: string;
  signedPreKey: { id: number; pub: string; sig: string };
  oneTimePreKey?: { id: number; pub: string } | null;
}

export function verifyBundle(bundle: PreKeyBundle): void {
  const signPub = unb64(bundle.identitySign);
  if (!verify(signPub, unb64(bundle.identityDh), unb64(bundle.identityDhSig))) throw new CryptoError('bad_signature', 'Bad identity in prekey bundle');
  if (!verify(signPub, unb64(bundle.signedPreKey.pub), unb64(bundle.signedPreKey.sig))) throw new CryptoError('bad_signature', 'Bad signed prekey');
}

/** Upload form. */
export const publicSignedPreKey = (k: SignedPreKey) => ({ id: k.id, pub: b64(k.key.pub), sig: b64(k.sig) });
export const publicOneTimePreKeys = (keys: OneTimePreKey[]) => keys.map((k) => ({ id: k.id, pub: b64(k.key.pub) }));
