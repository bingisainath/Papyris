// Linking a new device (docs/encryption-design-v2.md §3.3, §8). The new device shows a QR code with a
// one-off key and its identity; the primary certifies exactly those keys and sends a grant encrypted
// under ephemeral-ephemeral X25519. No long-term private key ever leaves its device.

import { aeadDecrypt, aeadEncrypt, b64, concatBytes, CryptoError, dh, fromUtf8, hkdf, KeyPair, newX25519, sha256, unb64, utf8 } from './primitives';
import type { DeviceIdentity, DeviceList } from './identity';
import type { MediaPointer } from './media';

const QR_PREFIX = 'papyris-link:2:';
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const b64url = (b: Uint8Array) => b64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => unb64(s.replace(/-/g, '+').replace(/_/g, '/'));

export interface LinkOffer {
  requestId: string;
  ek: Uint8Array; // one-off X25519 key of the new device
  identitySign: Uint8Array;
  identityDh: Uint8Array;
}

export const linkQrText = (o: LinkOffer): string =>
  `${QR_PREFIX}${o.requestId}:${b64url(o.ek)}:${b64url(o.identitySign)}:${b64url(o.identityDh)}`;

export function parseLinkQr(text: string): LinkOffer | null {
  if (!text.startsWith(QR_PREFIX)) return null;
  const [requestId, ek, sign, dhKey] = text.slice(QR_PREFIX.length).split(':');
  try {
    const offer = { requestId, ek: unb64url(ek), identitySign: unb64url(sign), identityDh: unb64url(dhKey) };
    return requestId && [offer.ek, offer.identitySign, offer.identityDh].every((k) => k.length === 32) ? offer : null;
  } catch {
    return null;
  }
}

/** 16 base32 characters (80 bits) of SHA-256 over all three keys: typed when the QR can't be scanned. */
export function linkCodeV2(o: Pick<LinkOffer, 'ek' | 'identitySign' | 'identityDh'>): string {
  const hash = sha256(concatBytes(o.ek, o.identitySign, o.identityDh));
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; out.length < 16; i++) {
    value = (value << 8) | hash[i];
    bits += 8;
    while (bits >= 5 && out.length < 16) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  return out;
}

/** What the primary sends (decrypted only by the new device). */
export interface GrantPayload {
  // Like Signal, every linked device holds the account key, so any of them can link the next one
  // and losing the first device doesn't force a fresh start (docs §3.3).
  account: { user: string; aik: string; aikPriv: string };
  device: { id: number; cert: string; created: number };
  deviceList: DeviceList;
  pins: { user: string; aik: string; verified: boolean }[];
  /** When the new device joined the list (server clock): older messages weren't encrypted for it. */
  joinedAt?: number;
  /** Old messages, encrypted as one PMV2 file whose key only travels here (docs §3.5). */
  history?: Pick<MediaPointer, 'url' | 'key' | 'sha256' | 'size'> & { count: number };
  /** The account's version 1 keys, for chats that still use version 1. */
  v1?: { secret: string; encPublic: string };
}

export interface LinkGrant { v: 2; requestId: string; e: string; c: string }

const linkKey = (shared: Uint8Array, requestId: string) => hkdf(sha256, shared, sha256(utf8(requestId)), utf8('PapyrisLink.v2'), 32);
const linkAad = (requestId: string, ekN: Uint8Array, eP: Uint8Array) => concatBytes(utf8(`PapyrisLink.v2|${requestId}`), ekN, eP);
const NONCE = new Uint8Array(12); // each link key encrypts exactly one message

/** Primary: encrypt the grant for the new device's one-off key. */
export function sealGrant(requestId: string, ekNew: Uint8Array, payload: GrantPayload): LinkGrant {
  const e = newX25519();
  const c = aeadEncrypt(linkKey(dh(e.priv, ekNew), requestId), NONCE, utf8(JSON.stringify(payload)), linkAad(requestId, ekNew, e.pub));
  e.priv.fill(0);
  return { v: 2, requestId, e: b64(e.pub), c: b64(c) };
}

/** New device: open the grant with its one-off key (then delete that key). */
export function openGrant(grant: LinkGrant, ekNew: KeyPair): GrantPayload {
  if (grant.v !== 2) throw new CryptoError('bad_format', 'Unknown link grant');
  const e = unb64(grant.e);
  const plain = aeadDecrypt(linkKey(dh(ekNew.priv, e), grant.requestId), NONCE, unb64(grant.c), linkAad(grant.requestId, ekNew.pub, e));
  return JSON.parse(fromUtf8(plain));
}

/** New device: everything needed to ask for linking. */
export function newLinkOffer(requestId: string, identity: DeviceIdentity): { offer: LinkOffer; ek: KeyPair } {
  const ek = newX25519();
  return { offer: { requestId, ek: ek.pub, identitySign: identity.sign.pub, identityDh: identity.dh.pub }, ek };
}
