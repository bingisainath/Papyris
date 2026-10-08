// Group messages with Sender Keys (docs/encryption-design-v2.md §5), as in Signal and WhatsApp:
// each sending device has a chain key and a signing key per group, shared with members through
// pairwise sessions; each message is encrypted once and signed. Rotated on membership changes.

import { b64, concatBytes, CryptoError, kdfCK, newEd25519, open, randomBytes, seal, sign, u32be, unb64, utf8, verify } from './primitives';

const MAX_FORWARD = 2000;
const MAX_SKIPPED = 2000;
export const SENDER_KEY_MAX_AGE_MS = 7 * 24 * 3600e3;
export const SENDER_KEY_MAX_MESSAGES = 1000;

export interface SenderKeyState {
  keyId: number;
  iteration: number;
  chainKey: Uint8Array;
  signPub: Uint8Array;
  signPriv?: Uint8Array; // only on the sender's own device
  created: number;
  skipped: Map<number, Uint8Array>;
}

export function newSenderKey(): SenderKeyState {
  const s = newEd25519();
  return {
    keyId: new DataView(randomBytes(4).buffer).getUint32(0), iteration: 0, chainKey: randomBytes(32),
    signPub: s.pub, signPriv: s.priv, created: Date.now(), skipped: new Map(),
  };
}

export const needsRotation = (s: SenderKeyState): boolean =>
  Date.now() - s.created > SENDER_KEY_MAX_AGE_MS || s.iteration >= SENDER_KEY_MAX_MESSAGES;

/** What each member device gets (inside a pairwise message, kind 'skdm'). Never the signing private key. */
export const distribution = (s: SenderKeyState) => ({ keyId: s.keyId, iteration: s.iteration, chainKey: b64(s.chainKey), signPub: b64(s.signPub) });

export function fromDistribution(d: { keyId: number; iteration: number; chainKey: string; signPub: string }): SenderKeyState {
  return { keyId: d.keyId, iteration: d.iteration, chainKey: unb64(d.chainKey), signPub: unb64(d.signPub), created: Date.now(), skipped: new Map() };
}

const groupAd = (conv: string, sender: string, keyId: number, iteration: number) =>
  concatBytes(utf8(`PapyrisGroup.v2|${conv}|${sender}|`), u32be(keyId), u32be(iteration));

export interface GroupCiphertext { keyId: number; iteration: number; ciphertext: Uint8Array; signature: Uint8Array }

/** Encrypt in place (the chain moves forward). `sender` = "user:device". */
export function groupEncrypt(s: SenderKeyState, conv: string, sender: string, plaintext: Uint8Array): GroupCiphertext {
  if (!s.signPriv) throw new CryptoError('no_session', 'Not our sender key');
  const [next, mk] = kdfCK(s.chainKey);
  const iteration = s.iteration;
  s.chainKey = next;
  s.iteration += 1;
  const ad = groupAd(conv, sender, s.keyId, iteration);
  const ciphertext = seal(mk, plaintext, ad);
  mk.fill(0);
  return { keyId: s.keyId, iteration, ciphertext, signature: sign(s.signPriv, concatBytes(ad, ciphertext)) };
}

/** Decrypt on a copy; the caller keeps the returned state only when the message is stored. */
export function groupDecrypt(state: SenderKeyState, conv: string, sender: string, p: GroupCiphertext): { state: SenderKeyState; plaintext: Uint8Array } {
  if (p.keyId !== state.keyId) throw new CryptoError('no_session', 'Unknown sender key');
  const ad = groupAd(conv, sender, p.keyId, p.iteration);
  if (!verify(state.signPub, concatBytes(ad, p.ciphertext), p.signature)) throw new CryptoError('bad_signature', 'Group message signature is invalid');
  const s: SenderKeyState = { ...state, chainKey: state.chainKey.slice(), skipped: new Map(state.skipped) };
  let mk = s.skipped.get(p.iteration);
  if (mk) {
    s.skipped.delete(p.iteration);
  } else {
    if (p.iteration < s.iteration) throw new CryptoError('replay', 'Message key already used');
    if (p.iteration - s.iteration > MAX_FORWARD) throw new CryptoError('too_many_skipped', 'Too many missing messages');
    while (s.iteration < p.iteration) {
      const [next, k] = kdfCK(s.chainKey);
      s.skipped.set(s.iteration, k);
      s.chainKey = next;
      s.iteration += 1;
    }
    const [next, k] = kdfCK(s.chainKey);
    s.chainKey = next;
    s.iteration += 1;
    mk = k;
    while (s.skipped.size > MAX_SKIPPED) s.skipped.delete(s.skipped.keys().next().value as number);
  }
  const plaintext = open(mk, p.ciphertext, ad);
  return { state: s, plaintext };
}

// ---- storage

export interface StoredSenderKey {
  keyId: number; iteration: number; chainKey: string; signPub: string; signPriv?: string; created: number; skipped: [number, string][];
}

export const storeSenderKey = (s: SenderKeyState): StoredSenderKey => ({
  keyId: s.keyId, iteration: s.iteration, chainKey: b64(s.chainKey), signPub: b64(s.signPub),
  ...(s.signPriv ? { signPriv: b64(s.signPriv) } : {}), created: s.created,
  skipped: Array.from(s.skipped.entries()).map(([i, k]) => [i, b64(k)]),
});

export const loadSenderKey = (s: StoredSenderKey): SenderKeyState => ({
  keyId: s.keyId, iteration: s.iteration, chainKey: unb64(s.chainKey), signPub: unb64(s.signPub),
  ...(s.signPriv ? { signPriv: unb64(s.signPriv) } : {}), created: s.created,
  skipped: new Map(s.skipped.map(([i, k]) => [i, unb64(k)])),
});
