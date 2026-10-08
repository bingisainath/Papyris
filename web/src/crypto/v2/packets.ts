// Wire formats (docs/encryption-design-v2.md §6.2, §6.3, §8), sent as JSON with base64 bytes.

import { b64, CryptoError, unb64 } from './primitives';
import type { Address, EncryptedForDevice, PreKeyInfo } from './session';
import type { GroupCiphertext } from './senderKeys';

export interface MessagePacket {
  v: 2;
  kind: 'pkmsg' | 'msg';
  conv: string;
  from: Address;
  to: Address;
  pre?: PreKeyInfo;
  h: string; // 40-byte ratchet header
  c: string;
}

export interface GroupPacket {
  v: 2;
  kind: 'skmsg';
  conv: string;
  from: Address;
  kid: number;
  it: number;
  c: string;
  sig: string;
}

export const toMessagePacket = (conv: string, from: Address, to: Address, e: EncryptedForDevice): MessagePacket => ({
  v: 2, kind: e.kind, conv, from, to, ...(e.pre ? { pre: e.pre } : {}), h: b64(e.header), c: b64(e.ciphertext),
});

export function fromMessagePacket(p: MessagePacket): EncryptedForDevice {
  if (p.v !== 2 || (p.kind !== 'pkmsg' && p.kind !== 'msg') || (p.kind === 'pkmsg' && !p.pre)) throw new CryptoError('bad_format', 'Unknown packet');
  return { kind: p.kind, pre: p.pre, header: unb64(p.h), ciphertext: unb64(p.c) };
}

export const toGroupPacket = (conv: string, from: Address, g: GroupCiphertext): GroupPacket => ({
  v: 2, kind: 'skmsg', conv, from, kid: g.keyId, it: g.iteration, c: b64(g.ciphertext), sig: b64(g.signature),
});

export function fromGroupPacket(p: GroupPacket): GroupCiphertext {
  if (p.v !== 2 || p.kind !== 'skmsg') throw new CryptoError('bad_format', 'Unknown packet');
  return { keyId: p.kid, iteration: p.it, ciphertext: unb64(p.c), signature: unb64(p.sig) };
}

/** "user:device", the sender name used inside group associated data. */
export const senderName = (a: Address): string => `${a.user}:${a.device}`;
