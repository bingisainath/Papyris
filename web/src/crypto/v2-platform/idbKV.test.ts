import 'fake-indexeddb/auto';
import { openIdbKV } from './idbKV';
import { EncryptedStore } from '../v2/storage';

test('IndexedDB storage: atomic writes, ordered ranges, values encrypted at rest', async () => {
  const kv = await openIdbKV('test-db');
  await kv.write([['m:c:0002:b', 'two'], ['m:c:0001:a', 'one'], ['m:c:0003:c', 'three'], ['m:d:0001:x', 'other'], ['p', 'x']]);
  expect(await kv.get('m:c:0001:a')).toBe('one');
  expect((await kv.range('m:c:')).map(([k]) => k)).toEqual(['m:c:0001:a', 'm:c:0002:b', 'm:c:0003:c']);
  expect((await kv.range('m:c:', { reverse: true, limit: 2 })).map(([, v]) => v)).toEqual(['three', 'two']);
  expect((await kv.range('m:c:', { reverse: true, before: 'm:c:0003' })).map(([, v]) => v)).toEqual(['two', 'one']);
  await kv.write([['m:c:0001:a', null]]);
  expect(await kv.get('m:c:0001:a')).toBeNull();

  // What's on disk is ciphertext
  const raw: any = await new Promise((resolve) => {
    const r = indexedDB.open('test-db');
    r.onsuccess = () => {
      const g = r.result.transaction('kv').objectStore('kv').get('m:c:0002:b');
      g.onsuccess = () => resolve(g.result);
    };
  });
  expect(new TextDecoder().decode(new Uint8Array(raw.data))).not.toContain('two');

  // Works under the store's transactions
  const store = new EncryptedStore(kv);
  await store.transaction(async (tx) => { await tx.savePin('u', { aik: 'k', verified: true, firstSeen: 1 }); });
  expect((await store.pin('u'))!.verified).toBe(true);
  await kv.clear();
  expect(await kv.get('p')).toBeNull();
});
