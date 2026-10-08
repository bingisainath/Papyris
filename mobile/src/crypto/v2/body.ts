// What's inside every encrypted message (docs/encryption-design-v2.md §6.1): a unique id and the
// conversation (so the server can't replay or re-route it), padded to 160-byte steps so length
// doesn't give short replies away.

import { CryptoError, fromUtf8, utf8 } from './primitives';
import type { MediaPointer } from './media';

export type BodyKind = 'text' | 'media' | 'edit' | 'delete' | 'reaction' | 'skdm' | 'sync' | 'read';

export interface MessageBody {
  v: 2;
  id: string; // unique per message (sender-chosen uuid)
  conv: string;
  ts: number;
  kind: BodyKind;
  text?: string;
  media?: MediaPointer[];
  replyTo?: string;
  edit?: { of: string; rev: number };
  reaction?: { of: string; emoji: string };
  skdm?: { keyId: number; iteration: number; chainKey: string; signPub: string };
  sync?: { conv: string; body: MessageBody };
  read?: { upTo: number };
}

const PAD_BLOCK = 160;

export function pad(b: Uint8Array): Uint8Array {
  const out = new Uint8Array(Math.ceil((b.length + 1) / PAD_BLOCK) * PAD_BLOCK);
  out.set(b);
  out[b.length] = 0x80;
  return out;
}

export function unpad(b: Uint8Array): Uint8Array {
  let i = b.length - 1;
  while (i >= 0 && b[i] === 0) i--;
  if (i < 0 || b[i] !== 0x80) throw new CryptoError('bad_format', 'Bad padding');
  return b.slice(0, i);
}

export const encodeBody = (body: MessageBody): Uint8Array => pad(utf8(JSON.stringify(body)));

/** Decode and check it belongs to the conversation the packet claims. */
export function decodeBody(bytes: Uint8Array, expectedConv: string): MessageBody {
  let body: MessageBody;
  try {
    body = JSON.parse(fromUtf8(unpad(bytes)));
  } catch {
    throw new CryptoError('bad_format', 'Unreadable message');
  }
  if (body?.v !== 2 || typeof body.id !== 'string' || typeof body.ts !== 'number') throw new CryptoError('bad_format', 'Unreadable message');
  // Sync copies to our own devices travel in our own "conversation" with ourselves; the real one is inside
  if (body.conv !== expectedConv) throw new CryptoError('replay', 'Message was moved to another conversation');
  return body;
}

/** Remembers recent message ids so a replayed packet is dropped (the app also checks its database). */
export class ReplayGuard {
  private seen = new Map<string, number>();
  constructor(private limit = 5000) {}
  check(id: string): boolean {
    if (this.seen.has(id)) return false;
    this.seen.set(id, Date.now());
    if (this.seen.size > this.limit) this.seen.delete(this.seen.keys().next().value as string);
    return true;
  }
}
