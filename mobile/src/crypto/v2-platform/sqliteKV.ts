// src/crypto/v2-platform/sqliteKV.ts
// The phone's storage for encryption v2 (see crypto/v2/storage.ts): an SQLite database encrypted as
// a whole with SQLCipher. Its random 256-bit key lives in the Keychain/Keystore, readable only by
// Papyris on this device.

import { open } from '@op-engineering/op-sqlite';
import * as Keychain from 'react-native-keychain';
import { randomBytes } from '@noble/hashes/utils';
import type { KV } from '../v2/storage';

const KEY_SERVICE = 'app.papyris.e2e.v2.db';
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

async function databaseKey(): Promise<string> {
  const saved = await Keychain.getGenericPassword({ service: KEY_SERVICE });
  if (saved) return saved.password;
  const key = hex(randomBytes(32));
  await Keychain.setGenericPassword('db', key, { service: KEY_SERVICE, accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
  return key;
}

export async function openSqliteKV(name = 'papyris-e2e-v2.sqlite'): Promise<KV> {
  // SQLCipher takes a raw key as x'<64 hex chars>' (no slow passphrase derivation needed)
  const db = open({ name, encryptionKey: `x'${await databaseKey()}'` });
  await db.execute('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL) WITHOUT ROWID');

  return {
    async get(k) {
      const r = await db.execute('SELECT v FROM kv WHERE k = ?', [k]);
      return r.rows.length ? String(r.rows[0].v) : null;
    },

    async write(entries) {
      await db.transaction(async (tx) => {
        for (const [k, v] of entries) {
          if (v === null) await tx.execute('DELETE FROM kv WHERE k = ?', [k]);
          else await tx.execute('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', [k, v]);
        }
      });
    },

    async range(prefix, o = {}) {
      // Keys are ASCII, so prefix + U+FFFF is above every key with that prefix
      const upper = o.before !== undefined && o.before < `${prefix}￿` ? o.before : `${prefix}￿`;
      const params: (string | number)[] = [prefix, upper];
      let sql = 'SELECT k, v FROM kv WHERE k >= ? AND k < ?';
      if (o.after !== undefined) {
        sql += ' AND k > ?';
        params.push(o.after);
      }
      sql += ` ORDER BY k ${o.reverse ? 'DESC' : 'ASC'}`;
      if (o.limit !== undefined) {
        sql += ' LIMIT ?';
        params.push(o.limit);
      }
      const r = await db.execute(sql, params);
      return r.rows.map((row) => [String(row.k), String(row.v)] as [string, string]);
    },

    async clear() {
      await db.execute('DELETE FROM kv');
    },
  };
}
