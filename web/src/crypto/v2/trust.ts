// Trusting other people's account keys (docs/encryption-design-v2.md §3.4; phase 6).
//
// - Security code: 60 digits from both account keys (safetyNumber), the same on both sides and
//   unchanged when either person links or removes a device. Compared aloud, or by scanning the
//   other person's QR code.
// - Verified: the person compared codes. If a verified contact's key later changes, sending to them
//   waits until the new code is accepted (Messenger refuses with 'identity_changed').
// - Changed: any key change is recorded, so the chat can say "X's security code changed" once.

import { b64, unb64 } from './primitives';
import { safetyNumber } from './identity';
import type { EncryptedStore, Pin } from './storage';

const QR_PREFIX = 'papyris-verify:1:';

export interface Trust {
  user: string;
  code: string | null; // null until both account keys are known
  verified: boolean;
  needsAccept: boolean;
  changedAt?: number; // only while the change hasn't been acknowledged
}

// A code takes ~10,000 SHA-256 rounds (slow on purpose); phones run that in an interpreter, so
// work it out once per pair of keys
const codes = new Map<string, string>();
function codeFor(me: string, myAik: string, other: string, theirAik: string): string {
  const key = `${me}:${myAik}|${other}:${theirAik}`;
  let code = codes.get(key);
  if (!code) {
    code = safetyNumber({ user: me, aik: unb64(myAik) }, { user: other, aik: unb64(theirAik) });
    if (codes.size > 500) codes.clear();
    codes.set(key, code);
  }
  return code;
}

/**
 * The security code between me and another person, and how far it's trusted. `withCode: false`
 * skips the code itself (the chat banner only needs to know whether it changed).
 */
export async function trustOf(store: EncryptedStore, me: string, other: string, options: { withCode?: boolean } = {}): Promise<Trust> {
  const [mine, theirs] = await Promise.all([store.pin(me), store.pin(other)]);
  return {
    user: other,
    code: mine && theirs && options.withCode !== false ? codeFor(me, mine.aik, other, theirs.aik) : null,
    verified: !!theirs?.verified,
    needsAccept: !!theirs?.needsAccept,
    changedAt: theirs?.changedAt && (!theirs.acknowledgedAt || theirs.acknowledgedAt < theirs.changedAt) ? theirs.changedAt : undefined,
  };
}

async function updatePin(store: EncryptedStore, user: string, patch: Partial<Pin>): Promise<void> {
  const pin = await store.pin(user);
  if (pin) await store.savePin(user, { ...pin, ...patch });
}

/** Mark as verified (codes compared) or not. Verifying also accepts a changed key. */
export async function setVerified(store: EncryptedStore, user: string, verified: boolean): Promise<void> {
  await updatePin(store, user, verified ? { verified, needsAccept: false, acknowledgedAt: Date.now() } : { verified });
}

/** Accept a verified contact's new key without comparing codes again (they're no longer verified). */
export async function acceptKeyChange(store: EncryptedStore, user: string): Promise<void> {
  await updatePin(store, user, { needsAccept: false, acknowledgedAt: Date.now() });
}

/** The "security code changed" notice was seen. */
export async function acknowledgeKeyChange(store: EncryptedStore, user: string): Promise<void> {
  await updatePin(store, user, { acknowledgedAt: Date.now() });
}

/** Text for the QR code the other person scans: both people and both account keys, in a fixed order. */
export async function verificationQr(store: EncryptedStore, me: string, other: string): Promise<string | null> {
  const [mine, theirs] = await Promise.all([store.pin(me), store.pin(other)]);
  if (!mine || !theirs) return null;
  return `${QR_PREFIX}${me}:${mine.aik}:${other}:${theirs.aik}`;
}

/**
 * Check a QR code scanned from the other person's screen. 'match': both see the same keys, so the
 * contact is marked verified. 'mismatch': someone has a different key (don't trust the chat).
 * 'other': it's not a Papyris verification code for this chat.
 */
export async function checkVerificationQr(store: EncryptedStore, me: string, other: string, text: string): Promise<'match' | 'mismatch' | 'other'> {
  if (!text.startsWith(QR_PREFIX)) return 'other';
  const parts = text.slice(QR_PREFIX.length).split(':');
  if (parts.length !== 4) return 'other';
  const [theirUser, theirAik, myUser, myAik] = parts; // their screen shows them first
  if (theirUser !== other || myUser !== me) return 'other';
  const [mine, theirs] = await Promise.all([store.pin(me), store.pin(other)]);
  if (!mine || !theirs) return 'mismatch';
  const same = (a: string, b: string) => {
    try {
      return b64(unb64(a)) === b64(unb64(b));
    } catch {
      return false;
    }
  };
  if (!same(theirAik, theirs.aik) || !same(myAik, mine.aik)) return 'mismatch';
  await setVerified(store, other, true);
  return 'match';
}
