// src/crypto/v2-platform/idbKV.ts
// The browser's storage for encryption v2 (see crypto/v2/storage.ts): IndexedDB, with every value
// encrypted (AES-256-GCM, WebCrypto) under a key the browser marks non-extractable, so page scripts
// can use it but its bytes can't be read out or copied off the disk as a plain key.
// Record names are ids and timestamps only; contents are encrypted.

import type { KV } from '../v2/storage';

const DB = 'papyris-e2e-v2';
const DATA = 'kv';
const META = 'meta';

interface Sealed { iv: Uint8Array; data: ArrayBuffer }

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Storage write aborted'));
  });
}

export async function openIdbKV(name = DB): Promise<KV> {
  const open = indexedDB.open(name, 1);
  open.onupgradeneeded = () => {
    open.result.createObjectStore(DATA);
    open.result.createObjectStore(META);
  };
  const db = await request(open);

  // One AES key per browser profile, created once and never exportable
  let key = await request(db.transaction(META, 'readonly').objectStore(META).get('key')) as CryptoKey | undefined;
  if (!key) {
    key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const tx = db.transaction(META, 'readwrite');
    tx.objectStore(META).put(key, 'key');
    await done(tx);
  }
  const aes = key;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const seal = async (k: string, v: string): Promise<Sealed> => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    // The record name is the associated data: a value can't be moved to another key
    return { iv, data: await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(k) }, aes, encoder.encode(v)) };
  };
  const unseal = async (k: string, s: Sealed): Promise<string> =>
    decoder.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: s.iv, additionalData: encoder.encode(k) }, aes, s.data));

  return {
    async get(k) {
      const s = await request(db.transaction(DATA, 'readonly').objectStore(DATA).get(k)) as Sealed | undefined;
      return s ? unseal(k, s) : null;
    },

    async write(entries) {
      // Encrypt first: an IndexedDB transaction closes if it waits on anything else
      const sealed = await Promise.all(entries.map(async ([k, v]) => [k, v === null ? null : await seal(k, v)] as const));
      const tx = db.transaction(DATA, 'readwrite');
      const store = tx.objectStore(DATA);
      for (const [k, v] of sealed) {
        if (v === null) store.delete(k);
        else store.put(v, k);
      }
      await done(tx);
    },

    async range(prefix, o = {}) {
      const lower = o.after !== undefined && o.after > prefix ? o.after : prefix;
      const upper = o.before !== undefined && o.before < `${prefix}￿` ? o.before : `${prefix}￿`;
      if (lower > upper) return [];
      const keyRange = IDBKeyRange.bound(lower, upper, o.after !== undefined && lower === o.after, true);
      const rows: [string, Sealed][] = [];
      const tx = db.transaction(DATA, 'readonly');
      await new Promise<void>((resolve, reject) => {
        const cursor = tx.objectStore(DATA).openCursor(keyRange, o.reverse ? 'prev' : 'next');
        cursor.onsuccess = () => {
          const c = cursor.result;
          if (!c || (o.limit !== undefined && rows.length >= o.limit)) return resolve();
          rows.push([String(c.key), c.value as Sealed]);
          c.continue();
        };
        cursor.onerror = () => reject(cursor.error);
      });
      return Promise.all(rows.map(async ([k, s]) => [k, await unseal(k, s)] as [string, string]));
    },

    async clear() {
      const tx = db.transaction(DATA, 'readwrite');
      tx.objectStore(DATA).clear();
      await done(tx);
    },
  };
}
