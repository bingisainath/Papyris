// Optional end-to-end encrypted backup, like WhatsApp's. Shared word for word by
// web/src/crypto/backup.ts and mobile/src/crypto/backup.ts.
//
// - The person gets a 64-digit recovery key (about 212 bits): only they keep it.
// - A backup holds what's needed to read their chats again with no device left: the account's
//   encryption keys (for messages kept on the server) and, with v2, the device's chat history.
// - It's encrypted on the device in the PMV2 format with a fresh random key; that key is sealed
//   with a key derived from the recovery key (XChaCha20-Poly1305). The server stores both, opaque.
// - A verifier (also derived from the recovery key) lets the app spot a mistyped key at once.
//   With 212 bits of key, nothing can be guessed from it.

import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';
import { randomBytes } from '@noble/hashes/utils';
import { fromBase64, fromUtf8, toBase64, utf8 } from './e2e';
import { decryptMedia, encryptMedia } from './v2/media';
import type { LocalMessage, Pin } from './v2/storage';

export interface BackupContent {
  v: 1;
  user: string;
  created: number;
  /** v1 account keys (64 bytes, base64): open the encrypted messages kept on the server */
  v1Secret?: string;
  v1EncPublic?: string;
  /** v2: this device's chat history and the contacts' pinned account keys */
  messages?: LocalMessage[];
  pins?: { user: string; pin: Pin }[];
}

export interface BackupMeta {
  url?: string;
  sha256: string;
  size: number;
  wrapped_key: { n: string; c: string };
  verifier: string;
}

export class BackupError extends Error {
  constructor(public code: 'wrong_key' | 'damaged', message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

/** 64 random digits (unbiased: bytes ≥ 250 are skipped). */
export function newRecoveryKey(): string {
  let digits = '';
  while (digits.length < 64) {
    for (const b of randomBytes(80)) {
      if (b < 250 && digits.length < 64) digits += String(b % 10);
    }
  }
  return digits;
}

export const formatRecoveryKey = (digits: string): string => digits.replace(/(\d{4})(?=\d)/g, '$1 ');
export const normalizeRecoveryKey = (typed: string): string => typed.replace(/\D/g, '');
export const isRecoveryKey = (typed: string): boolean => normalizeRecoveryKey(typed).length === 64;

/** What the device keeps to make new backups without asking for the key again. */
export interface BackupKey { wrap: string; verifier: string }

export function backupKeyFrom(recoveryKey: string): BackupKey {
  const digits = normalizeRecoveryKey(recoveryKey);
  if (digits.length !== 64) throw new BackupError('wrong_key', 'The recovery key has 64 digits');
  const salt = utf8('PapyrisBackup.v1');
  return {
    wrap: toBase64(hkdf(sha256, utf8(digits), salt, utf8('wrap'), 32)),
    verifier: toBase64(hkdf(sha256, utf8(digits), salt, utf8('verifier'), 32)),
  };
}

const AAD = utf8('PapyrisBackup.v1 key');

/** Encrypt a backup. Upload `blob`, then save the returned meta with its url. */
export function sealBackup(key: BackupKey, content: BackupContent): { blob: Uint8Array; meta: Omit<BackupMeta, 'url'> } {
  const media = encryptMedia(utf8(JSON.stringify(content)));
  const nonce = randomBytes(24);
  const c = xchacha20poly1305(fromBase64(key.wrap), nonce, AAD).encrypt(fromBase64(media.key));
  return {
    blob: media.blob,
    meta: { sha256: media.sha256, size: media.size, wrapped_key: { n: toBase64(nonce), c: toBase64(c) }, verifier: key.verifier },
  };
}

/** Check a typed recovery key against a backup before downloading it. */
export function checkRecoveryKey(recoveryKey: string, meta: Pick<BackupMeta, 'verifier'>): BackupKey {
  const key = backupKeyFrom(recoveryKey);
  if (key.verifier !== meta.verifier) throw new BackupError('wrong_key', "That recovery key doesn't match your backup");
  return key;
}

export function openBackup(key: BackupKey, meta: BackupMeta, blob: Uint8Array): BackupContent {
  let fileKey: Uint8Array;
  try {
    fileKey = xchacha20poly1305(fromBase64(key.wrap), fromBase64(meta.wrapped_key.n), AAD).decrypt(fromBase64(meta.wrapped_key.c));
  } catch {
    throw new BackupError('wrong_key', "That recovery key doesn't match your backup");
  }
  try {
    const content = JSON.parse(fromUtf8(decryptMedia(blob, { key: toBase64(fileKey), sha256: meta.sha256, size: meta.size }))) as BackupContent;
    if (content.v !== 1) throw new Error('version');
    return content;
  } catch {
    throw new BackupError('damaged', 'The backup is damaged or incomplete');
  }
}
