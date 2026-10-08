// Phase 3: encrypted local storage and device upkeep, with an in-memory server.

import {
  Address, b64, decodeBody, decryptFrom, DeviceList, DeviceManager, E2EHttp, encodeBody, EncryptedStore, encryptFor, LocalMessage,
  MemoryKV, PreKeyBundle, ProtocolStore, verifyDeviceList, fromMessagePacket, toMessagePacket, unb64, verify,
} from './index';

/** Just enough of the v2 server for these tests (same rules as backend/app/api/v1/e2e_v2.py). */
class FakeServer {
  devices = new Map<string, { sign: string; dh: string; dhSig: string }>();
  spk = new Map<string, { id: number; pub: string; sig: string }>();
  opks = new Map<string, { id: number; pub: string }[]>();
  lists = new Map<string, DeviceList>();
  next = new Map<string, number>();
  calls: string[] = [];

  http(user: string): E2EHttp {
    const fail = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });
    return {
      get: async <T,>(path: string): Promise<T> => {
        this.calls.push(`GET ${path}`);
        let m = path.match(/^\/e2e\/v2\/devices\/(\d+)\/prekeys$/);
        if (m) {
          const k = `${user}:${m[1]}`;
          return { one_time_left: (this.opks.get(k) || []).length, signed_prekey: this.spk.has(k) ? { id: this.spk.get(k)!.id, created_at: '' } : null } as T;
        }
        m = path.match(/^\/e2e\/v2\/users\/([^/]+)\/device-list$/);
        if (m) {
          const list = this.lists.get(m[1]);
          if (!list) throw fail(404);
          return list as T;
        }
        m = path.match(/^\/e2e\/v2\/users\/([^/]+)\/devices\/(\d+)\/bundle$/);
        if (m) return this.bundle(m[1], Number(m[2])) as T;
        throw fail(404);
      },
      post: async <T,>(path: string, body?: any): Promise<T> => {
        this.calls.push(`POST ${path}`);
        if (path === '/e2e/v2/devices') {
          if (!verify(unb64(body.sign), unb64(body.dh), unb64(body.dhSig))) throw fail(422);
          const id = (this.next.get(user) || 0) + 1;
          this.next.set(user, id);
          this.devices.set(`${user}:${id}`, body);
          return { device_id: id } as T;
        }
        throw fail(404);
      },
      put: async <T,>(path: string, body?: any): Promise<T> => {
        this.calls.push(`PUT ${path}`);
        const m = path.match(/^\/e2e\/v2\/devices\/(\d+)\/prekeys$/);
        if (m) {
          const k = `${user}:${m[1]}`;
          const device = this.devices.get(k)!;
          if (body.signedPreKey) {
            if (!verify(unb64(device.sign), unb64(body.signedPreKey.pub), unb64(body.signedPreKey.sig))) throw fail(422);
            this.spk.set(k, body.signedPreKey);
          }
          if (body.oneTimePreKeys) this.opks.set(k, [...(this.opks.get(k) || []), ...body.oneTimePreKeys]);
          return {} as T;
        }
        if (path === '/e2e/v2/device-list') {
          const current = this.lists.get(user);
          verifyDeviceList(body.device_list, user, current ? unb64(current.aik) : undefined, current ? current.version + 1 : undefined);
          this.lists.set(user, body.device_list);
          return {} as T;
        }
        throw fail(404);
      },
      del: async <T,>(path: string): Promise<T> => {
        this.calls.push(`DELETE ${path}`);
        return {} as T;
      },
    };
  }

  bundle(user: string, device: number): PreKeyBundle {
    const k = `${user}:${device}`;
    const d = this.devices.get(k)!;
    return { user, deviceId: device, identitySign: d.sign, identityDh: d.dh, identityDhSig: d.dhSig, signedPreKey: this.spk.get(k)!, oneTimePreKey: (this.opks.get(k) || []).shift() || null };
  }
}

describe('device upkeep', () => {
  it('first device registers, uploads prekeys and becomes the primary; nothing repeats on the next start', async () => {
    const server = new FakeServer();
    const store = new EncryptedStore(new MemoryKV());
    const manager = new DeviceManager(store, server.http('alice'), 'alice', 'Phone');
    const state = await manager.bootstrap();
    expect(state).toEqual({ deviceId: 1, primary: true, listed: true });
    expect(server.opks.get('alice:1')).toHaveLength(100);
    const list = server.lists.get('alice')!;
    expect(verifyDeviceList(list, 'alice').map((d) => d.id)).toEqual([1]);
    expect(await store.accountKey()).not.toBeNull();

    server.calls = [];
    expect(await manager.bootstrap()).toEqual(state);
    expect(server.calls.filter((c) => !c.startsWith('GET'))).toEqual([]); // no new registration or uploads
  });

  it('a second device of the same account registers but waits to be linked (no account key)', async () => {
    const server = new FakeServer();
    await new DeviceManager(new EncryptedStore(new MemoryKV()), server.http('alice'), 'alice', 'Phone').bootstrap();
    const laptop = new EncryptedStore(new MemoryKV());
    expect(await new DeviceManager(laptop, server.http('alice'), 'alice', 'Laptop').bootstrap()).toEqual({ deviceId: 2, primary: false, listed: false });
    expect(await laptop.accountKey()).toBeNull();
    expect(server.lists.get('alice')!.version).toBe(1);
  });

  it('refills one-time prekeys below 25 and rotates the signed prekey weekly, keeping old ones 30 days', async () => {
    const server = new FakeServer();
    const store = new EncryptedStore(new MemoryKV());
    let now = 1_000_000_000_000;
    const manager = new DeviceManager(store, server.http('bob'), 'bob', 'Phone', () => now);
    await manager.bootstrap();
    server.opks.set('bob:1', server.opks.get('bob:1')!.slice(0, 20)); // 80 were used
    await manager.ensurePrekeys();
    const ids = server.opks.get('bob:1')!.map((k) => k.id);
    expect(ids).toHaveLength(100);
    expect(new Set(ids).size).toBe(100); // never reused
    expect(await store.oneTimePreKey(ids[99])).not.toBeNull();

    const firstSpk = server.spk.get('bob:1')!.id;
    now += 8 * 24 * 3600e3;
    await manager.ensurePrekeys();
    expect(server.spk.get('bob:1')!.id).not.toBe(firstSpk);
    expect(await store.signedPreKey(firstSpk)).not.toBeNull(); // still answers late first messages
    now += 31 * 24 * 3600e3;
    await manager.ensurePrekeys();
    expect(await store.signedPreKey(firstSpk)).toBeNull();
  });

  it('a different account on the same device starts clean; logout wipes everything', async () => {
    const server = new FakeServer();
    const kv = new MemoryKV();
    const store = new EncryptedStore(kv);
    await new DeviceManager(store, server.http('alice'), 'alice', 'Phone').bootstrap();
    await store.saveMessage({ id: 'm1', conv: 'c', sender: { user: 'alice', device: 1 }, ts: 1, kind: 'text', text: 'private' });
    await new DeviceManager(store, server.http('carol'), 'carol', 'Phone').bootstrap();
    expect(await store.message('m1')).toBeNull();
    expect((await store.device())!.userId).toBe('carol');
    await new DeviceManager(store, server.http('carol'), 'carol', 'Phone').logout();
    expect(kv.data.size).toBe(0);
  });
});

describe('sessions through the encrypted store', () => {
  it('a conversation between two stored devices, with transactional receive', async () => {
    const server = new FakeServer();
    const aliceStore = new EncryptedStore(new MemoryKV());
    const bobStore = new EncryptedStore(new MemoryKV());
    await new DeviceManager(aliceStore, server.http('alice'), 'alice', 'A').bootstrap();
    await new DeviceManager(bobStore, server.http('bob'), 'bob', 'B').bootstrap();
    const alice: Address = { user: 'alice', device: 1 };
    const bob: Address = { user: 'bob', device: 1 };
    const bobPublic = verifyDeviceList(server.lists.get('bob')!, 'bob')[0];
    const alicePublic = verifyDeviceList(server.lists.get('alice')!, 'alice')[0];

    const send = async (from: ProtocolStore, fromAddr: Address, to: Address, toPublic: typeof bobPublic, text: string) =>
      toMessagePacket('c1', fromAddr, to, await encryptFor(from, to, toPublic, encodeBody({ v: 2, id: text, conv: 'c1', ts: Date.now(), kind: 'text', text }), async () => server.bundle(to.user, to.device)));

    const p1 = await send(aliceStore, alice, bob, bobPublic, 'hello');
    // Receive inside a transaction that also stores the message; a failure in between saves nothing
    await expect(bobStore.transaction(async (tx) => {
      const { plaintext, commit } = await decryptFrom(tx, alice, alicePublic, fromMessagePacket(p1));
      await commit();
      await tx.saveMessage({ id: decodeBody(plaintext, 'c1').id, conv: 'c1', sender: alice, ts: 1, kind: 'text', text: 'hello' });
      throw new Error('crash before the transaction ends');
    })).rejects.toThrow('crash');
    expect(await bobStore.loadSession(alice)).toBeNull();
    expect(await bobStore.message('hello')).toBeNull();

    await bobStore.transaction(async (tx) => {
      const { plaintext, commit } = await decryptFrom(tx, alice, alicePublic, fromMessagePacket(p1));
      await commit();
      const body = decodeBody(plaintext, 'c1');
      await tx.saveMessage({ id: body.id, conv: 'c1', sender: alice, ts: body.ts, kind: 'text', text: body.text });
    });
    expect((await bobStore.message('hello'))!.text).toBe('hello');
    const reply = await send(bobStore, bob, alice, alicePublic, 'hi back');
    const { plaintext } = await decryptFrom(aliceStore, bob, bobPublic, fromMessagePacket(reply));
    expect(decodeBody(plaintext, 'c1').text).toBe('hi back');
  });
});

describe('transactions', () => {
  it('writes outside a running transaction are not caught up in it', async () => {
    const kv = new MemoryKV();
    const store = new EncryptedStore(kv);
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const running = store.transaction(async (tx) => {
      await tx.savePin('x', { aik: 'a', verified: false, firstSeen: 1 });
      await gate;
      throw new Error('fails');
    }).catch(() => 'failed');
    await store.savePin('y', { aik: 'b', verified: false, firstSeen: 2 }); // meanwhile, a direct write
    release();
    expect(await running).toBe('failed');
    expect(await store.pin('y')).not.toBeNull(); // saved
    expect(await store.pin('x')).toBeNull(); // rolled back
  });
});

describe('local message database', () => {
  const msg = (id: string, ts: number, conv = 'c1'): LocalMessage => ({ id, conv, sender: { user: 'u', device: 1 }, ts, kind: 'text', text: id });

  it('pages newest first, ignores duplicates, keeps chats apart', async () => {
    const store = new EncryptedStore(new MemoryKV());
    for (let i = 1; i <= 7; i++) await store.saveMessage(msg(`m${i}`, 1000 + i));
    await store.saveMessage(msg('other', 5000, 'c2'));
    expect(await store.saveMessage(msg('m3', 1003))).toBe(false);
    expect((await store.messages('c1', { limit: 3 })).map((m) => m.id)).toEqual(['m7', 'm6', 'm5']);
    expect((await store.messages('c1', { limit: 3, beforeTs: 1005 })).map((m) => m.id)).toEqual(['m4', 'm3', 'm2']);
    expect((await store.lastMessage('c2'))!.id).toBe('other');
    expect(await store.hasMessage('m1')).toBe(true);
  });

  it('edits only move forward; deletes clear the content', async () => {
    const store = new EncryptedStore(new MemoryKV());
    await store.saveMessage(msg('m1', 1));
    expect((await store.editMessage('m1', 2, 'second', 10))!.text).toBe('second');
    expect(await store.editMessage('m1', 1, 'rolled back', 11)).toBeNull(); // an old version can't come back
    expect((await store.message('m1'))!.text).toBe('second');
    await store.deleteMessage('m1');
    const deleted = (await store.message('m1'))!;
    expect(deleted.deleted && deleted.text === undefined).toBe(true);
  });

  it('exports and imports history (for linking a device)', async () => {
    const from = new EncryptedStore(new MemoryKV());
    for (let i = 1; i <= 5; i++) await from.saveMessage(msg(`m${i}`, i * 100, i % 2 ? 'c1' : 'c2'));
    const exported = await from.exportMessages(200);
    expect(exported.map((m) => m.id).sort()).toEqual(['m2', 'm3', 'm4', 'm5']);
    const to = new EncryptedStore(new MemoryKV());
    expect(await to.importMessages(exported)).toBe(4);
    expect(await to.importMessages(exported)).toBe(0);
    expect((await to.messages('c1')).map((m) => m.id)).toEqual(['m5', 'm3']);
    expect(b64(new Uint8Array([1]))).toBe('AQ==');
  });
});
