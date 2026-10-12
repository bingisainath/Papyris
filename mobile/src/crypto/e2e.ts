// End-to-end encryption core, shared word for word by the web app (web/src/crypto/e2e.ts) and the
// phone app (mobile/src/crypto/e2e.ts). Keep the two files identical (`npm run check:e2e` in web).
//
// Design (version 1):
// - Each account has an X25519 key pair (encryption) and an Ed25519 key pair (signing), created
//   on its first device. The server only ever gets the public keys. Another device gets the private
//   keys by linking, like WhatsApp Web: it shows a QR code with a one-off public key, a signed-in
//   device scans it and sends the keys encrypted for that one-off key (sealKeysForDevice).
// - A message is encrypted once with a fresh random key (XChaCha20-Poly1305). That key is sealed
//   separately for every member of the chat, including the sender: one ephemeral X25519 key per
//   message, ECDH with each member's public key, HKDF-SHA256, XChaCha20-Poly1305.
// - The sender signs the envelope (Ed25519), bound to the chat and the sender, so the server can't
//   alter a message, move it to another chat or pass it off as someone else's.
// - Files are encrypted in 64 KiB chunks with their own random key, which travels inside the
//   encrypted message. Chunks are numbered and the last one is marked, so they can't be
//   reordered or cut short.
//
// Libraries: @noble/curves, @noble/ciphers, @noble/hashes (audited, plain JavaScript, so the exact
// same code runs in browsers and in React Native).

import { ed25519, x25519 } from '@noble/curves/ed25519';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';
import { randomBytes } from '@noble/hashes/utils';

export const E2E_VERSION = 1;
const PREFIX = 'e2e1:'; // stored message text starts with this when it's an encrypted envelope
const WRAP_INFO = 'papyris-e2e-v1 key wrap';
const SIGN_LABEL = 'papyris-e2e-v1 message';

// ---------- small helpers ----------

// TextEncoder/TextDecoder where available; a small fallback for JavaScript engines without them.
// (Looked up on globalThis: React Native's TypeScript types don't declare them.)
const platform = globalThis as unknown as {
  TextEncoder?: new () => { encode(text: string): Uint8Array };
  TextDecoder?: new () => { decode(bytes: Uint8Array): string };
};

export function utf8(text: string): Uint8Array {
  if (platform.TextEncoder) return new platform.TextEncoder().encode(text);
  const out: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return new Uint8Array(out);
}

export function fromUtf8(bytes: Uint8Array): string {
  if (platform.TextDecoder) return new platform.TextDecoder().decode(bytes);
  let out = '';
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i];
    let c: number;
    if (b < 0x80) { c = b; i += 1; }
    else if (b < 0xe0) { c = ((b & 31) << 6) | (bytes[i + 1] & 63); i += 2; }
    else if (b < 0xf0) { c = ((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63); i += 3; }
    else { c = ((b & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63); i += 4; }
    out += String.fromCodePoint(c);
  }
  return out;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX = (() => {
  const table = new Uint8Array(128).fill(255);
  for (let i = 0; i < B64.length; i++) table[B64.charCodeAt(i)] = i;
  return table;
})();

/** Base64 without relying on Buffer/btoa (not everywhere in React Native) and safe for large data. */
export function toBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  let line = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    line += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)]
      + (i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)] : '=')
      + (i + 2 < bytes.length ? B64[c & 63] : '=');
    if (line.length >= 8192) {
      parts.push(line);
      line = '';
    }
  }
  parts.push(line);
  return parts.join('');
}

export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/[\s=]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const value = code < 128 ? B64_INDEX[code] : 255;
    if (value === 255) throw new Error('Invalid base64');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function lengthPrefixed(...parts: Uint8Array[]): Uint8Array {
  return concat(...parts.flatMap((p) => {
    const len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, p.length);
    return [len, p];
  }));
}

export class E2EError extends Error {
  constructor(public code: 'not_a_recipient' | 'tampered' | 'unknown_format' | 'bad_signature', message: string) {
    super(message);
    this.name = 'E2EError';
  }
}

// ---------- account keys ----------

export interface KeyPairs {
  encPrivate: Uint8Array; // X25519
  encPublic: Uint8Array;
  signPrivate: Uint8Array; // Ed25519 seed
  signPublic: Uint8Array;
}

/** Public half, as the server stores and hands out (base64). */
export interface PublicKeys {
  enc: string;
  sign: string;
}

export function generateKeys(): KeyPairs {
  const encPrivate = x25519.utils.randomPrivateKey();
  const signPrivate = ed25519.utils.randomPrivateKey();
  return { encPrivate, encPublic: x25519.getPublicKey(encPrivate), signPrivate, signPublic: ed25519.getPublicKey(signPrivate) };
}

export function publicKeysOf(keys: KeyPairs): PublicKeys {
  return { enc: toBase64(keys.encPublic), sign: toBase64(keys.signPublic) };
}

/** 64 bytes (X25519 private + Ed25519 seed): the form kept in the device's secure storage. */
export function keysToSecret(keys: KeyPairs): Uint8Array {
  return concat(keys.encPrivate, keys.signPrivate);
}

export function keysFromSecret(secret: Uint8Array): KeyPairs {
  const encPrivate = secret.slice(0, 32);
  const signPrivate = secret.slice(32, 64);
  return { encPrivate, encPublic: x25519.getPublicKey(encPrivate), signPrivate, signPublic: ed25519.getPublicKey(signPrivate) };
}

// ---------- linking another device ----------

const LINK_PREFIX = 'papyris-link:1:';
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** One-off key pair a new device uses to receive the account keys. */
export function newLinkKey(): { privateKey: Uint8Array; publicKey: Uint8Array } {
  const privateKey = x25519.utils.randomPrivateKey();
  return { privateKey, publicKey: x25519.getPublicKey(privateKey) };
}

/**
 * The 16-character code shown under the QR (80 bits of the one-off key's SHA-256, base32): typing it
 * proves the approving device is talking to the right new device. Same as link_code() on the server.
 */
export function linkCode(publicKey: Uint8Array): string {
  const hash = sha256(publicKey);
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

/** "ABCD-EFGH-IJKL-MNOP" for reading out or typing. */
export const formatLinkCode = (code: string): string => code.replace(/(.{4})(?=.)/g, '$1-');

export const normalizeLinkCode = (typed: string): string => typed.toUpperCase().replace(/[^A-Z2-7]/g, '');

/** What the new device's QR code holds: the request and its one-off public key. */
export function linkQrText(requestId: string, publicKey: Uint8Array): string {
  return `${LINK_PREFIX}${requestId}:${toBase64(publicKey)}`;
}

export function parseLinkQr(text: string): { requestId: string; publicKey: Uint8Array } | null {
  if (!text.startsWith(LINK_PREFIX)) return null;
  const [requestId, key] = text.slice(LINK_PREFIX.length).split(':');
  try {
    const publicKey = fromBase64(key || '');
    return requestId && publicKey.length === 32 ? { requestId, publicKey } : null;
  } catch {
    return null;
  }
}

export interface SealedKeys {
  e: string; // sender's one-off public key
  n: string;
  c: string;
}

const linkAad = (requestId: string) => utf8(`papyris-e2e-v1 link|${requestId}`);

function linkWrapKey(shared: Uint8Array, a: Uint8Array, b: Uint8Array) {
  return hkdf(sha256, shared, concat(a, b), utf8('papyris-e2e-v1 link'), 32);
}

/** Signed-in device: encrypt the account keys so only the new device (its one-off key) can open them. */
export function sealKeysForDevice(keys: KeyPairs, devicePublic: Uint8Array, requestId: string): SealedKeys {
  const own = x25519.utils.randomPrivateKey();
  const ownPublic = x25519.getPublicKey(own);
  const key = linkWrapKey(x25519.getSharedSecret(own, devicePublic), ownPublic, devicePublic);
  const nonce = randomBytes(24);
  const c = xchacha20poly1305(key, nonce, linkAad(requestId)).encrypt(keysToSecret(keys));
  return { e: toBase64(ownPublic), n: toBase64(nonce), c: toBase64(c) };
}

/** New device: open the keys sent by the signed-in device. */
export function openKeysFromDevice(sealed: SealedKeys, devicePrivate: Uint8Array, requestId: string): KeyPairs {
  try {
    const senderPublic = fromBase64(sealed.e);
    const devicePublic = x25519.getPublicKey(devicePrivate);
    const key = linkWrapKey(x25519.getSharedSecret(devicePrivate, senderPublic), senderPublic, devicePublic);
    return keysFromSecret(xchacha20poly1305(key, fromBase64(sealed.n), linkAad(requestId)).decrypt(fromBase64(sealed.c)));
  } catch {
    throw new E2EError('tampered', "Couldn't open the keys from the other device");
  }
}

/**
 * Security code for a pair of people, like Signal's safety number: both sides see the same 60 digits
 * when the server handed out the right keys. Compare it in person to rule out a swapped key.
 */
export function securityCode(a: { userId: string; keys: PublicKeys }, b: { userId: string; keys: PublicKeys }): string {
  const part = (p: { userId: string; keys: PublicKeys }) => {
    const hash = sha256(concat(utf8(p.userId), fromBase64(p.keys.enc), fromBase64(p.keys.sign)));
    let digits = '';
    for (let i = 0; i < 30; i += 5) {
      // 40 bits per group (exact in a JS number), reduced to 5 digits
      const n = (hash[i] * 2 ** 32 + hash[i + 1] * 2 ** 24 + hash[i + 2] * 2 ** 16 + hash[i + 3] * 2 ** 8 + hash[i + 4]) % 100000;
      digits += String(n).padStart(5, '0');
    }
    return digits;
  };
  const [first, second] = [a, b].sort((x, y) => (x.userId < y.userId ? -1 : 1));
  return (part(first) + part(second)).replace(/(\d{5})/g, '$1 ').trim();
}

// ---------- messages ----------

/** What's inside an encrypted message. */
export interface E2EPayload {
  t?: string; // text or caption
  m?: E2EMedia;
  l?: boolean; // contains a link (also told to the server so the Links tab works)
}

export interface E2EMedia {
  key: string; // file key (base64)
  type: 'image' | 'video' | 'audio' | 'file';
  mime: string;
  name?: string;
  size?: number;
  w?: number;
  h?: number;
  d?: number; // seconds
  tk?: string; // key of the encrypted poster (video), whose URL is the message's media_thumbnail
}

interface Envelope {
  v: number;
  s: string; // sender's signing public key
  e: string; // ephemeral X25519 public key
  n: string; // content nonce
  c: string; // content ciphertext
  k: Record<string, string>; // userId -> sealed content key
  g: string; // Ed25519 signature
}

export interface Recipient {
  userId: string;
  enc: string; // their X25519 public key (base64)
}

export const isEncryptedText = (text: string | null | undefined): boolean => !!text && text.startsWith(PREFIX);

function wrapKey(shared: Uint8Array, ephemeralPublic: Uint8Array, recipientPublic: Uint8Array) {
  return hkdf(sha256, shared, concat(ephemeralPublic, recipientPublic), utf8(WRAP_INFO), 32);
}

function contentAad(conversationId: string, senderId: string) {
  return utf8(`papyris-e2e-v1|${conversationId}|${senderId}`);
}

function signedBytes(conversationId: string, senderId: string, env: Omit<Envelope, 'g'>) {
  const keys = Object.keys(env.k).sort().flatMap((id) => [utf8(id), fromBase64(env.k[id])]);
  return lengthPrefixed(
    utf8(SIGN_LABEL), utf8(conversationId), utf8(senderId), fromBase64(env.s), fromBase64(env.e), fromBase64(env.n), fromBase64(env.c), ...keys,
  );
}

/** Encrypt a message for everyone in `recipients` (include the sender). Returns the text to send. */
export function sealMessage(
  payload: E2EPayload,
  context: { conversationId: string; senderId: string },
  recipients: Recipient[],
  sender: KeyPairs,
): string {
  const contentKey = randomBytes(32);
  const nonce = randomBytes(24);
  const c = xchacha20poly1305(contentKey, nonce, contentAad(context.conversationId, context.senderId))
    .encrypt(utf8(JSON.stringify(payload)));

  const ephemeralPrivate = x25519.utils.randomPrivateKey();
  const ephemeralPublic = x25519.getPublicKey(ephemeralPrivate);
  const k: Record<string, string> = {};
  for (const r of recipients) {
    const recipientPublic = fromBase64(r.enc);
    const shared = x25519.getSharedSecret(ephemeralPrivate, recipientPublic);
    // Each wrap key is used exactly once, so a fixed nonce is safe here
    k[r.userId] = toBase64(xchacha20poly1305(wrapKey(shared, ephemeralPublic, recipientPublic), new Uint8Array(24)).encrypt(contentKey));
  }
  const unsigned = { v: E2E_VERSION, s: toBase64(sender.signPublic), e: toBase64(ephemeralPublic), n: toBase64(nonce), c: toBase64(c), k };
  const g = toBase64(ed25519.sign(signedBytes(context.conversationId, context.senderId, unsigned), sender.signPrivate));
  return PREFIX + JSON.stringify({ ...unsigned, g });
}

export interface Opened {
  payload: E2EPayload;
  /** The signing key the sender used; check it belongs to them (see isKnownKey) */
  senderSignKey: string;
}

/** Decrypt a message sealed by sealMessage. Throws E2EError if it isn't for us or was altered. */
export function openMessage(
  text: string,
  context: { conversationId: string; senderId: string; myId: string },
  keys: KeyPairs,
): Opened {
  if (!isEncryptedText(text)) throw new E2EError('unknown_format', 'Not an encrypted message');
  let env: Envelope;
  try {
    env = JSON.parse(text.slice(PREFIX.length));
  } catch {
    throw new E2EError('unknown_format', 'Unreadable envelope');
  }
  if (env.v !== E2E_VERSION) throw new E2EError('unknown_format', 'Unsupported version');
  const { g, ...unsigned } = env;
  let valid = false;
  try {
    valid = ed25519.verify(fromBase64(g), signedBytes(context.conversationId, context.senderId, unsigned), fromBase64(env.s));
  } catch {
    valid = false;
  }
  if (!valid) throw new E2EError('bad_signature', 'Signature check failed');

  const sealed = env.k[context.myId];
  if (!sealed) throw new E2EError('not_a_recipient', 'Not encrypted for this account');
  const ephemeralPublic = fromBase64(env.e);
  let contentKey: Uint8Array;
  try {
    const shared = x25519.getSharedSecret(keys.encPrivate, ephemeralPublic);
    contentKey = xchacha20poly1305(wrapKey(shared, ephemeralPublic, keys.encPublic), new Uint8Array(24)).decrypt(fromBase64(sealed));
  } catch {
    throw new E2EError('not_a_recipient', 'Sealed for a different key');
  }
  try {
    const plain = xchacha20poly1305(contentKey, fromBase64(env.n), contentAad(context.conversationId, context.senderId)).decrypt(fromBase64(env.c));
    return { payload: JSON.parse(fromUtf8(plain)), senderSignKey: env.s };
  } catch {
    throw new E2EError('tampered', 'Message was altered');
  }
}

// ---------- files ----------

export const FILE_CHUNK = 64 * 1024;
export const FILE_HEADER = 16; // random nonce prefix at the start of an encrypted file
const TAG = 16;

export const newFileKey = (): Uint8Array => randomBytes(32);

/** Size of the encrypted file for a plaintext of `size` bytes. */
export const encryptedSize = (size: number): number => FILE_HEADER + size + TAG * Math.max(1, Math.ceil(size / FILE_CHUNK));

function chunkNonce(prefix: Uint8Array, index: number) {
  const nonce = new Uint8Array(24);
  nonce.set(prefix, 0);
  const view = new DataView(nonce.buffer);
  view.setUint32(16, Math.floor(index / 2 ** 32));
  view.setUint32(20, index >>> 0);
  return nonce;
}

const LAST = new Uint8Array([1]);
const NOT_LAST = new Uint8Array([0]);

/** Streaming encryption: call header() once, then push() each 64 KiB plaintext chunk in order. */
export class FileEncryptor {
  private prefix = randomBytes(FILE_HEADER);
  private index = 0;
  constructor(private key: Uint8Array) {}
  header(): Uint8Array {
    return this.prefix;
  }
  push(chunk: Uint8Array, last: boolean): Uint8Array {
    if (!last && chunk.length !== FILE_CHUNK) throw new Error('Only the last chunk may be short');
    return xchacha20poly1305(this.key, chunkNonce(this.prefix, this.index++), last ? LAST : NOT_LAST).encrypt(chunk);
  }
}

/** Streaming decryption: feed the 16-byte header, then each (64 KiB + 16) encrypted chunk in order. */
export class FileDecryptor {
  private index = 0;
  constructor(private key: Uint8Array, private prefix: Uint8Array) {
    if (prefix.length !== FILE_HEADER) throw new E2EError('unknown_format', 'Bad file header');
  }
  push(chunk: Uint8Array, last: boolean): Uint8Array {
    try {
      return xchacha20poly1305(this.key, chunkNonce(this.prefix, this.index++), last ? LAST : NOT_LAST).decrypt(chunk);
    } catch {
      throw new E2EError('tampered', 'File was altered or cut short');
    }
  }
}

/** Whole-file helpers (web, small files and tests). */
export function encryptFile(key: Uint8Array, data: Uint8Array): Uint8Array {
  const enc = new FileEncryptor(key);
  const parts = [enc.header()];
  if (data.length === 0) parts.push(enc.push(data, true));
  for (let offset = 0; offset < data.length; offset += FILE_CHUNK) {
    const end = Math.min(offset + FILE_CHUNK, data.length);
    parts.push(enc.push(data.subarray(offset, end), end === data.length));
  }
  return concat(...parts);
}

export function decryptFile(key: Uint8Array, data: Uint8Array): Uint8Array {
  if (data.length < FILE_HEADER + TAG) throw new E2EError('tampered', 'File too short');
  const dec = new FileDecryptor(key, data.subarray(0, FILE_HEADER));
  const parts: Uint8Array[] = [];
  const step = FILE_CHUNK + TAG;
  for (let offset = FILE_HEADER; offset < data.length; offset += step) {
    const end = Math.min(offset + step, data.length);
    parts.push(dec.push(data.subarray(offset, end), end === data.length));
  }
  return concat(...parts);
}

// ---------- photos ----------

/**
 * Remove EXIF/XMP (location, camera serial), IPTC and comments from a JPEG without re-encoding.
 * The server used to do this; with end-to-end encryption it can't see the photo, so the app does.
 * Same rules as backend/app/services/media_processing.strip_jpeg_metadata.
 */
export function stripJpegMetadata(data: Uint8Array): Uint8Array {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return data;
  const parts: Uint8Array[] = [data.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= data.length && data[i] === 0xff) {
    const marker = data[i + 1];
    if (marker === 0xda) {
      parts.push(data.subarray(i));
      return concat(...parts);
    }
    const length = (data[i + 2] << 8) | data[i + 3];
    if (marker !== 0xe1 && marker !== 0xed && marker !== 0xfe) parts.push(data.subarray(i, i + 2 + length));
    i += 2 + length;
  }
  return data;
}

/** EXIF orientation (1-8) of a JPEG, read before stripping so the app can keep photos upright. */
export function jpegOrientation(data: Uint8Array): number {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return 1;
  let i = 2;
  while (i + 4 <= data.length && data[i] === 0xff) {
    const marker = data[i + 1];
    const length = (data[i + 2] << 8) | data[i + 3];
    if (marker === 0xe1 && fromUtf8(data.subarray(i + 4, i + 8)) === 'Exif') {
      try {
        const tiff = i + 10;
        const little = data[tiff] === 0x49;
        const view = new DataView(data.buffer, data.byteOffset, data.length);
        const u16 = (o: number) => view.getUint16(o, little);
        const u32 = (o: number) => view.getUint32(o, little);
        const ifd = tiff + u32(tiff + 4);
        const count = u16(ifd);
        for (let e = 0; e < count; e++) {
          const entry = ifd + 2 + e * 12;
          if (u16(entry) === 0x0112) return u16(entry + 8);
        }
      } catch {
        // malformed EXIF: treat as upright (its data is stripped either way)
      }
      return 1;
    }
    if (marker === 0xda) break;
    i += 2 + length;
  }
  return 1;
}
