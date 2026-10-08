// The Double Ratchet (docs/encryption-design-v2.md §4.2-4.5), following Signal's specification
// (rev. 4): a new key for every message, new DH material every round trip, skipped-message keys for
// out-of-order delivery, and transactional decryption (state only changes when decryption works).

import { b64, concatBytes, CryptoError, dh, eq, kdfCK, kdfRK, KeyPair, newX25519, open, seal, u32be, unb64 } from './primitives';

export const MAX_SKIP = 1000; // how far ahead one message may jump
const MAX_STORED_SKIPPED = 2000;
const SKIPPED_TTL_MS = 30 * 24 * 3600e3;

export interface Header { dh: Uint8Array; pn: number; n: number }

export const HEADER_LENGTH = 40;
export const encodeHeader = (h: Header): Uint8Array => concatBytes(h.dh, u32be(h.pn), u32be(h.n));
export function decodeHeader(b: Uint8Array): Header {
  if (b.length !== HEADER_LENGTH) throw new CryptoError('bad_format', 'Bad message header');
  const v = new DataView(b.buffer, b.byteOffset, HEADER_LENGTH);
  return { dh: b.slice(0, 32), pn: v.getUint32(32), n: v.getUint32(36) };
}

interface SkippedKey { dh: Uint8Array; n: number; mk: Uint8Array; at: number }

export interface RatchetState {
  ad: Uint8Array;
  dhs: KeyPair;
  dhr: Uint8Array | null;
  rk: Uint8Array;
  cks: Uint8Array | null;
  ckr: Uint8Array | null;
  ns: number;
  nr: number;
  pn: number;
  skipped: SkippedKey[];
}

export function initSender(sk: Uint8Array, ad: Uint8Array, theirRatchetKey: Uint8Array): RatchetState {
  const dhs = newX25519();
  const [rk, cks] = kdfRK(sk, dh(dhs.priv, theirRatchetKey));
  return { ad, dhs, dhr: theirRatchetKey, rk, cks, ckr: null, ns: 0, nr: 0, pn: 0, skipped: [] };
}

export function initReceiver(sk: Uint8Array, ad: Uint8Array, signedPreKey: KeyPair): RatchetState {
  return { ad, dhs: { priv: signedPreKey.priv.slice(), pub: signedPreKey.pub.slice() }, dhr: null, rk: sk, cks: null, ckr: null, ns: 0, nr: 0, pn: 0, skipped: [] };
}

export const canSend = (s: RatchetState): boolean => !!s.cks;

/** Encrypt in place (the state moves forward). */
export function ratchetEncrypt(s: RatchetState, plaintext: Uint8Array): { header: Uint8Array; ciphertext: Uint8Array } {
  if (!s.cks) throw new CryptoError('no_session', 'This session has no sending chain yet');
  const [next, mk] = kdfCK(s.cks);
  s.cks = next;
  const header = encodeHeader({ dh: s.dhs.pub, pn: s.pn, n: s.ns });
  s.ns += 1;
  const ciphertext = seal(mk, plaintext, concatBytes(s.ad, header));
  mk.fill(0);
  return { header, ciphertext };
}

/** Decrypt on a copy of the state; the caller keeps the returned state only on success. */
export function ratchetDecrypt(state: RatchetState, headerBytes: Uint8Array, ciphertext: Uint8Array): { state: RatchetState; plaintext: Uint8Array } {
  const s = cloneState(state);
  const h = decodeHeader(headerBytes);
  const ad = concatBytes(s.ad, headerBytes);

  const i = s.skipped.findIndex((k) => k.n === h.n && eq(k.dh, h.dh));
  if (i >= 0) {
    const plaintext = open(s.skipped[i].mk, ciphertext, ad);
    s.skipped[i].mk.fill(0);
    s.skipped.splice(i, 1);
    return { state: s, plaintext };
  }
  if (!s.dhr || !eq(h.dh, s.dhr)) {
    skipKeys(s, h.pn);
    // DH ratchet step: a receiving chain from their new key, then a new sending chain from ours
    s.pn = s.ns;
    s.ns = 0;
    s.nr = 0;
    s.dhr = h.dh;
    [s.rk, s.ckr] = kdfRK(s.rk, dh(s.dhs.priv, s.dhr));
    s.dhs = newX25519();
    [s.rk, s.cks] = kdfRK(s.rk, dh(s.dhs.priv, s.dhr));
  }
  if (h.n < s.nr) throw new CryptoError('replay', 'Message key already used');
  skipKeys(s, h.n);
  const [next, mk] = kdfCK(s.ckr!);
  s.ckr = next;
  s.nr += 1;
  const plaintext = open(mk, ciphertext, ad);
  mk.fill(0);
  return { state: s, plaintext };
}

function skipKeys(s: RatchetState, until: number) {
  if (!s.ckr) return;
  if (until - s.nr > MAX_SKIP) throw new CryptoError('too_many_skipped', 'Too many missing messages');
  while (s.nr < until) {
    const [next, mk] = kdfCK(s.ckr);
    s.ckr = next;
    s.skipped.push({ dh: s.dhr!, n: s.nr, mk, at: Date.now() });
    s.nr += 1;
  }
  const cutoff = Date.now() - SKIPPED_TTL_MS;
  s.skipped = s.skipped.filter((k) => k.at > cutoff).slice(-MAX_STORED_SKIPPED);
}

export function cloneState(s: RatchetState): RatchetState {
  const c = (b: Uint8Array | null) => (b ? b.slice() : null);
  return {
    ...s,
    ad: s.ad.slice(),
    dhs: { priv: s.dhs.priv.slice(), pub: s.dhs.pub.slice() },
    dhr: c(s.dhr),
    rk: s.rk.slice(),
    cks: c(s.cks),
    ckr: c(s.ckr),
    skipped: s.skipped.map((k) => ({ ...k, dh: k.dh.slice(), mk: k.mk.slice() })),
  };
}

// ---- storage (kept in the device's encrypted local database)

export interface StoredRatchet {
  ad: string; dhsPriv: string; dhsPub: string; dhr: string | null; rk: string; cks: string | null; ckr: string | null;
  ns: number; nr: number; pn: number; skipped: { dh: string; n: number; mk: string; at: number }[];
}

export const storeRatchet = (s: RatchetState): StoredRatchet => ({
  ad: b64(s.ad), dhsPriv: b64(s.dhs.priv), dhsPub: b64(s.dhs.pub), dhr: s.dhr && b64(s.dhr), rk: b64(s.rk),
  cks: s.cks && b64(s.cks), ckr: s.ckr && b64(s.ckr), ns: s.ns, nr: s.nr, pn: s.pn,
  skipped: s.skipped.map((k) => ({ dh: b64(k.dh), n: k.n, mk: b64(k.mk), at: k.at })),
});

export const loadRatchet = (s: StoredRatchet): RatchetState => ({
  ad: unb64(s.ad), dhs: { priv: unb64(s.dhsPriv), pub: unb64(s.dhsPub) }, dhr: s.dhr ? unb64(s.dhr) : null, rk: unb64(s.rk),
  cks: s.cks ? unb64(s.cks) : null, ckr: s.ckr ? unb64(s.ckr) : null, ns: s.ns, nr: s.nr, pn: s.pn,
  skipped: s.skipped.map((k) => ({ dh: unb64(k.dh), n: k.n, mk: unb64(k.mk), at: k.at })),
});
