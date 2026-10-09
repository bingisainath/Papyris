// Encrypted local storage for v2 (docs/encryption-design-v2.md §4.6, phase 3), on top of a small
// key-value interface each app implements with encryption at rest:
//   web: IndexedDB, every value encrypted with a non-extractable AES-GCM key (web/src/crypto/v2-platform)
//   phone: SQLite with SQLCipher, key in the Keychain/Keystore (mobile/src/crypto/v2-platform)
//
// It keeps this device's identity, prekeys, sessions, sender keys, pinned account keys, device
// lists and the local message database. Writes made during one operation are saved together
// (transaction), so a message and the session state that decrypted it can't get out of step.

import type { KeyPair } from './primitives';
import { loadDeviceIdentity, loadKeyPair, storeKeyPair, DeviceIdentity, DeviceList, StoredKeyPair, StoredDeviceIdentity } from './identity';
import type { Address, ProtocolStore, SessionRecord } from './session';
import { loadSenderKey, SenderKeyState, storeSenderKey, StoredSenderKey } from './senderKeys';
import type { MediaPointer } from './media';

/** What each app provides: string keys and values, atomic batch writes, ordered prefix ranges. */
export interface KV {
  get(key: string): Promise<string | null>;
  /** All-or-nothing; null deletes. */
  write(entries: [string, string | null][]): Promise<void>;
  /** Keys starting with `prefix` (between `after` and `before` if given), in key order. */
  range(prefix: string, options?: { limit?: number; reverse?: boolean; before?: string; after?: string }): Promise<[string, string][]>;
  clear(): Promise<void>;
}

/** In-memory KV (tests, and as a reference for the platform versions). */
export class MemoryKV implements KV {
  data = new Map<string, string>();
  async get(key: string) { return this.data.get(key) ?? null; }
  async write(entries: [string, string | null][]) {
    for (const [k, v] of entries) {
      if (v === null) this.data.delete(k);
      else this.data.set(k, v);
    }
  }
  async range(prefix: string, o: { limit?: number; reverse?: boolean; before?: string; after?: string } = {}) {
    let keys = Array.from(this.data.keys()).filter((k) => k.startsWith(prefix) && (o.before === undefined || k < o.before) && (o.after === undefined || k > o.after)).sort();
    if (o.reverse) keys.reverse();
    if (o.limit !== undefined) keys = keys.slice(0, o.limit);
    return keys.map((k) => [k, this.data.get(k)!] as [string, string]);
  }
  async clear() { this.data.clear(); }
}

// ---- local message records

export interface LocalMessage {
  id: string; // the sender's message id (inside the encrypted body)
  conv: string;
  sender: Address;
  ts: number;
  kind: 'text' | 'media' | 'system';
  text?: string;
  media?: MediaPointer[];
  replyTo?: string;
  rev?: number; // last edit applied
  editedAt?: number;
  deleted?: boolean;
  reactions?: Record<string, string[]>; // emoji -> user ids
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  serverId?: string; // the server's timeline row (for receipts, replies)
}

const pad13 = (n: number) => String(Math.max(0, Math.floor(n))).padStart(13, '0');
const messageKey = (conv: string, ts: number, id: string) => `m:${conv}:${pad13(ts)}:${id}`;

/** Serialises store operations: one at a time, so concurrent sends/receives can't interleave writes. */
class Mutex {
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn, fn);
    this.tail = result.catch(() => undefined);
    return result;
  }
}

export interface DeviceRecord {
  userId: string;
  deviceId: number | null; // null until registered with the server
  identity: StoredDeviceIdentity;
  primary: boolean;
  listed: boolean; // on the account's signed device list (able to send and receive)
}

export interface Pin {
  aik: string; // the account key we trust for this person (b64)
  verified: boolean; // the person compared security codes (or scanned the QR code)
  firstSeen: number;
  changedAt?: number; // the key changed (they started fresh): "security code changed" notice
  previousAik?: string;
  acknowledgedAt?: number; // the notice was seen
  needsAccept?: boolean; // they were verified when the key changed: sending waits until it's accepted
}

/**
 * Everything v2 keeps on the device. Outside a transaction each write is saved immediately.
 * Inside `transaction(tx => ...)`, `tx` is a view whose writes are buffered and saved together at
 * the end (nothing on error), e.g. receiving a message: session + used prekey + the message itself.
 * Transactions run one at a time.
 */
export class StoreView implements ProtocolStore {
  constructor(protected kv: KV, protected pending: Map<string, string | null> | null = null) {}

  private async read(key: string): Promise<string | null> {
    if (this.pending?.has(key)) return this.pending.get(key) ?? null;
    return this.kv.get(key);
  }

  private async put(key: string, value: unknown) {
    const s = value === null ? null : JSON.stringify(value);
    if (this.pending) this.pending.set(key, s);
    else await this.kv.write([[key, s]]);
  }

  private async getJson<T>(key: string): Promise<T | null> {
    const s = await this.read(key);
    return s === null ? null : (JSON.parse(s) as T);
  }

  /** Prefix range that also sees this transaction's pending writes. */
  private async rangeJson<T>(prefix: string): Promise<[string, T][]> {
    const stored = new Map((await this.kv.range(prefix)).map(([k, v]) => [k, v] as [string, string | null]));
    this.pending?.forEach((v, k) => { if (k.startsWith(prefix)) stored.set(k, v); });
    return Array.from(stored.entries()).filter((e): e is [string, string] => e[1] !== null).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, JSON.parse(v) as T]);
  }


  // ---- this device

  async device(): Promise<DeviceRecord | null> { return this.getJson<DeviceRecord>('device'); }
  async saveDevice(d: DeviceRecord) { await this.put('device', d); }

  async identity(): Promise<DeviceIdentity> {
    const d = await this.device();
    if (!d) throw new Error('This device has no encryption identity yet');
    return loadDeviceIdentity(d.identity);
  }

  async accountKey(): Promise<KeyPair | null> {
    const k = await this.getJson<StoredKeyPair>('aik');
    return k ? loadKeyPair(k) : null;
  }
  async saveAccountKey(k: KeyPair) { await this.put('aik', storeKeyPair(k)); }

  // ---- prekeys

  async signedPreKey(id: number): Promise<KeyPair | null> {
    const k = await this.getJson<{ key: StoredKeyPair }>(`spk:${id}`);
    return k ? loadKeyPair(k.key) : null;
  }
  async saveSignedPreKey(id: number, key: KeyPair, sig: string, created: number) { await this.put(`spk:${id}`, { key: storeKeyPair(key), sig, created }); }
  /** Upload form of a stored signed prekey (the signature is kept with it). */
  async signedPreKeyPublic(id: number): Promise<{ id: number; pub: string; sig: string } | null> {
    const k = await this.getJson<{ key: StoredKeyPair; sig: string }>(`spk:${id}`);
    return k ? { id, pub: k.key.pub, sig: k.sig } : null;
  }
  async signedPreKeys(): Promise<{ id: number; created: number }[]> {
    return (await this.rangeJson<{ created: number }>('spk:')).map(([k, v]) => ({ id: Number(k.slice(4)), created: v.created }));
  }
  async removeSignedPreKey(id: number) { await this.put(`spk:${id}`, null); }

  async oneTimePreKey(id: number): Promise<KeyPair | null> {
    const k = await this.getJson<StoredKeyPair>(`opk:${id}`);
    return k ? loadKeyPair(k) : null;
  }
  async saveOneTimePreKeys(keys: { id: number; key: KeyPair }[]) {
    if (this.pending) keys.forEach((k) => this.pending!.set(`opk:${k.id}`, JSON.stringify(storeKeyPair(k.key))));
    else await this.kv.write(keys.map((k) => [`opk:${k.id}`, JSON.stringify(storeKeyPair(k.key))]));
  }
  async removeOneTimePreKey(id: number) { await this.put(`opk:${id}`, null); }

  /** Counters for prekey ids (never reused). */
  async nextId(name: 'spk' | 'opk', count = 1): Promise<number> {
    const current = (await this.getJson<number>(`next:${name}`)) ?? 1;
    await this.put(`next:${name}`, current + count);
    return current;
  }

  // ---- sessions

  async loadSession(peer: Address): Promise<SessionRecord | null> { return this.getJson<SessionRecord>(`ses:${peer.user}:${peer.device}`); }
  async saveSession(peer: Address, record: SessionRecord) { await this.put(`ses:${peer.user}:${peer.device}`, record); }
  async removeSession(peer: Address) { await this.put(`ses:${peer.user}:${peer.device}`, null); }

  // ---- group sender keys (ours and other members')

  async senderKey(conv: string, sender: Address): Promise<SenderKeyState | null> {
    const k = await this.getJson<StoredSenderKey>(`sk:${conv}:${sender.user}:${sender.device}`);
    return k ? loadSenderKey(k) : null;
  }
  async saveSenderKey(conv: string, sender: Address, state: SenderKeyState) { await this.put(`sk:${conv}:${sender.user}:${sender.device}`, storeSenderKey(state)); }
  async removeSenderKey(conv: string, sender: Address) { await this.put(`sk:${conv}:${sender.user}:${sender.device}`, null); }

  // ---- contacts: pinned account keys and their last verified device lists

  async pin(user: string): Promise<Pin | null> { return this.getJson<Pin>(`pin:${user}`); }
  async savePin(user: string, pin: Pin) { await this.put(`pin:${user}`, pin); }
  async pins(): Promise<{ user: string; pin: Pin }[]> {
    return (await this.rangeJson<Pin>('pin:')).map(([k, pin]) => ({ user: k.slice(4), pin }));
  }

  async deviceList(user: string): Promise<DeviceList | null> { return this.getJson<DeviceList>(`dl:${user}`); }
  async saveDeviceList(user: string, list: DeviceList) { await this.put(`dl:${user}`, list); }

  // ---- small settings (e.g. the backup key, last backup time)

  async setting<T>(name: string): Promise<T | null> { return this.getJson<T>(`set:${name}`); }
  async saveSetting(name: string, value: unknown) { await this.put(`set:${name}`, value); }

  // ---- local message database

  /** Store (or update) a message. Returns false if a message with this id is already stored. */
  async saveMessage(m: LocalMessage, replace = false): Promise<boolean> {
    const existing = await this.getJson<string>(`mid:${m.id}`);
    if (existing && !replace) return false;
    if (existing && existing !== messageKey(m.conv, m.ts, m.id)) await this.put(existing, null);
    await this.put(messageKey(m.conv, m.ts, m.id), m);
    await this.put(`mid:${m.id}`, messageKey(m.conv, m.ts, m.id));
    if (m.serverId) await this.put(`sid:${m.serverId}`, m.id);
    return true;
  }

  async messageByServerId(serverId: string): Promise<LocalMessage | null> {
    const id = await this.getJson<string>(`sid:${serverId}`);
    return id ? this.message(id) : null;
  }

  async message(id: string): Promise<LocalMessage | null> {
    const key = await this.getJson<string>(`mid:${id}`);
    return key ? this.getJson<LocalMessage>(key) : null;
  }

  async hasMessage(id: string): Promise<boolean> {
    return (await this.read(`mid:${id}`)) !== null;
  }

  /** Newest first, `limit` messages older than `beforeTs` (exclusive). */
  async messages(conv: string, options: { limit?: number; beforeTs?: number } = {}): Promise<LocalMessage[]> {
    const before = options.beforeTs !== undefined ? `m:${conv}:${pad13(options.beforeTs)}` : undefined;
    const rows = await this.kv.range(`m:${conv}:`, { reverse: true, limit: options.limit ?? 50, before });
    return rows.map(([, v]) => JSON.parse(v) as LocalMessage);
  }

  async lastMessage(conv: string): Promise<LocalMessage | null> {
    return (await this.messages(conv, { limit: 1 }))[0] || null;
  }

  /** Apply an edit, only if it's newer than what's stored (an old version can't be put back). */
  async editMessage(id: string, rev: number, text: string, at: number): Promise<LocalMessage | null> {
    const m = await this.message(id);
    if (!m || m.deleted || (m.rev ?? 0) >= rev) return null;
    const updated = { ...m, text, rev, editedAt: at };
    await this.saveMessage(updated, true);
    return updated;
  }

  async deleteMessage(id: string): Promise<LocalMessage | null> {
    const m = await this.message(id);
    if (!m) return null;
    const updated: LocalMessage = { ...m, deleted: true, text: undefined, media: undefined, reactions: undefined };
    await this.saveMessage(updated, true);
    return updated;
  }

  /** Every stored message of every chat since `fromTs` (for moving history to a linked device). */
  async exportMessages(fromTs = 0): Promise<LocalMessage[]> {
    return (await this.kv.range('m:')).map(([, v]) => JSON.parse(v) as LocalMessage).filter((m) => m.ts >= fromTs);
  }

  async importMessages(messages: LocalMessage[]): Promise<number> {
    let added = 0;
    for (const m of messages) if (await this.saveMessage(m)) added += 1;
    return added;
  }
}

export class EncryptedStore extends StoreView {
  private lock = new Mutex();

  constructor(kv: KV) {
    super(kv, null);
  }

  /** Run `fn` with a view whose writes are saved in one atomic write at the end (nothing on error). */
  transaction<T>(fn: (tx: StoreView) => Promise<T>): Promise<T> {
    return this.lock.run(async () => {
      const pending = new Map<string, string | null>();
      const result = await fn(new StoreView(this.kv, pending));
      if (pending.size) await this.kv.write(Array.from(pending.entries()));
      return result;
    });
  }

  async wipe() {
    await this.lock.run(() => this.kv.clear());
  }
}
