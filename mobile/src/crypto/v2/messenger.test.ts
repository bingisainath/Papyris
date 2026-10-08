// Phase 4: sending and receiving between several people with several devices each.

import {
  Address, certifyDevice, DeviceList, DeviceManager, E2EHttp, EncryptedStore, IncomingEnvelope, loadDeviceIdentity, MemoryKV, Messenger,
  MessageBody, OutgoingEnvelope, PreKeyBundle, Received, signDeviceList, unb64, verify, verifyDeviceList,
} from './index';

/** An in-memory v2 server: devices, prekeys, signed lists, mailboxes (rules as in the backend). */
class Server {
  devices = new Map<string, { sign: string; dh: string; dhSig: string }>();
  spk = new Map<string, { id: number; pub: string; sig: string }>();
  opks = new Map<string, { id: number; pub: string }[]>();
  lists = new Map<string, DeviceList>();
  next = new Map<string, number>();
  mail = new Map<string, IncomingEnvelope[]>();
  seq = 0;

  http(user: string): E2EHttp {
    const fail = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });
    return {
      get: async <T,>(path: string): Promise<T> => {
        let m = path.match(/^\/e2e\/v2\/devices\/(\d+)\/prekeys$/);
        if (m) {
          const k = `${user}:${m[1]}`;
          return { one_time_left: (this.opks.get(k) || []).length, signed_prekey: this.spk.has(k) ? { id: this.spk.get(k)!.id, created_at: '' } : null } as T;
        }
        m = path.match(/^\/e2e\/v2\/users\/([^/]+)\/device-list$/);
        if (m) {
          if (!this.lists.has(m[1])) throw fail(404);
          return JSON.parse(JSON.stringify(this.lists.get(m[1]))) as T;
        }
        m = path.match(/^\/e2e\/v2\/users\/([^/]+)\/devices\/(\d+)\/bundle$/);
        if (m) {
          const k = `${m[1]}:${m[2]}`;
          const d = this.devices.get(k)!;
          return { user: m[1], deviceId: Number(m[2]), identitySign: d.sign, identityDh: d.dh, identityDhSig: d.dhSig, signedPreKey: this.spk.get(k)!, oneTimePreKey: (this.opks.get(k) || []).shift() || null } as PreKeyBundle as T;
        }
        m = path.match(/^\/e2e\/v2\/mailbox\/(\d+)$/);
        if (m) return JSON.parse(JSON.stringify(this.mail.get(`${user}:${m[1]}`) || [])) as T;
        throw fail(404);
      },
      post: async <T,>(path: string, body?: any): Promise<T> => {
        if (path === '/e2e/v2/devices') {
          if (!verify(unb64(body.sign), unb64(body.dh), unb64(body.dhSig))) throw fail(422);
          const id = (this.next.get(user) || 0) + 1;
          this.next.set(user, id);
          this.devices.set(`${user}:${id}`, body);
          return { device_id: id } as T;
        }
        const m = path.match(/^\/e2e\/v2\/mailbox\/(\d+)\/ack$/);
        if (m) {
          const k = `${user}:${m[1]}`;
          this.mail.set(k, (this.mail.get(k) || []).filter((e) => !body.ids.includes(e.id)));
          return {} as T;
        }
        throw fail(404);
      },
      put: async <T,>(path: string, body?: any): Promise<T> => {
        const m = path.match(/^\/e2e\/v2\/devices\/(\d+)\/prekeys$/);
        if (m) {
          const k = `${user}:${m[1]}`;
          if (body.signedPreKey) this.spk.set(k, body.signedPreKey);
          if (body.oneTimePreKeys) this.opks.set(k, [...(this.opks.get(k) || []), ...body.oneTimePreKeys]);
          return {} as T;
        }
        if (path === '/e2e/v2/device-list') {
          verifyDeviceList(body.device_list, user);
          this.lists.set(user, body.device_list);
          return {} as T;
        }
        throw fail(404);
      },
      del: async <T,>(): Promise<T> => ({} as T),
    };
  }

  /** What the WebSocket does with `message_v2`: put each packet in its device's mailbox. */
  deliver(from: Address, envelopes: OutgoingEnvelope[], messageId?: string) {
    for (const e of envelopes) {
      const k = `${e.to_user}:${e.to_device}`;
      this.mail.set(k, [...(this.mail.get(k) || []), { id: `env-${++this.seq}`, from, conversation_id: e.packet.conv, message_id: messageId || null, packet: JSON.parse(JSON.stringify(e.packet)) }]);
    }
  }
}

class Device {
  store = new EncryptedStore(new MemoryKV());
  manager: DeviceManager;
  messenger!: Messenger;
  address!: Address;
  inbox: Received[] = [];

  constructor(public server: Server, public user: string, name: string) {
    this.manager = new DeviceManager(this.store, server.http(user), user, name);
  }

  async start() {
    const state = await this.manager.bootstrap();
    this.address = { user: this.user, device: state.deviceId };
    this.messenger = new Messenger(this.store, this.server.http(this.user), this.address);
    return this;
  }

  async send(conv: string, isGroup: boolean, members: string[], text: string, id = `${this.user}-${Math.random().toString(36).slice(2, 8)}`) {
    const body: MessageBody = { v: 2, id, conv, ts: Date.now(), kind: 'text', text };
    const envelopes = await this.messenger.encrypt(conv, isGroup, members, body);
    await this.messenger.rememberSent({ id, conv, sender: this.address, ts: body.ts, kind: 'text', text, status: 'sending' });
    this.server.deliver(this.address, envelopes, `srv-${id}`);
    return { id, envelopes };
  }

  /** Process the mailbox; returns the texts of new messages. */
  async read(): Promise<string[]> {
    const texts: string[] = [];
    await this.messenger.drain((r) => {
      this.inbox.push(r);
      if (r.kind === 'message') texts.push(r.message.text || '');
    });
    return texts;
  }
}

/** The primary device certifies another device of the same account (what linking will do in phase 5). */
async function link(primary: Device, other: Device) {
  const aik = (await primary.store.accountKey())!;
  const current = primary.server.lists.get(primary.user)!;
  const device = (await other.store.device())!;
  const id = loadDeviceIdentity(device.identity);
  const cert = certifyDevice(aik.priv, primary.user, device.deviceId!, { sign: id.sign.pub, dh: id.dh.pub, dhSig: id.dhSig });
  await primary.server.http(primary.user).put('/e2e/v2/device-list', { device_list: signDeviceList(aik, primary.user, current.version + 1, [...current.devices, cert]) });
  await other.start(); // now listed
  primary.messenger.forget(primary.user);
}

async function setup() {
  const server = new Server();
  const alicePhone = await new Device(server, 'alice', 'Alice phone').start();
  const aliceLaptop = await new Device(server, 'alice', 'Alice laptop').start();
  await link(alicePhone, aliceLaptop);
  const bob = await new Device(server, 'bob', 'Bob phone').start();
  const carol = await new Device(server, 'carol', 'Carol phone').start();
  return { server, alicePhone, aliceLaptop, bob, carol };
}

describe('direct chats', () => {
  it('reach every device of both people, and both sides keep a local copy', async () => {
    const { alicePhone, aliceLaptop, bob } = await setup();
    expect(await alicePhone.messenger.ready(['alice', 'bob'])).toBe(true);
    const sent = await alicePhone.send('dm', false, ['alice', 'bob'], 'hi bob');
    expect(sent.envelopes.map((e) => `${e.to_user}:${e.to_device}`).sort()).toEqual(['alice:2', 'bob:1']); // bob + alice's laptop

    expect(await bob.read()).toEqual(['hi bob']);
    expect(await aliceLaptop.read()).toEqual(['hi bob']); // her own message, shown on her laptop too
    const onBob = (await bob.store.messages('dm'))[0];
    expect(onBob.sender).toEqual(alicePhone.address);
    expect(onBob.serverId).toBe(`srv-${sent.id}`);
    expect((await bob.messenger.byServerId(`srv-${sent.id}`))!.text).toBe('hi bob');

    await bob.send('dm', false, ['alice', 'bob'], 'hello alice');
    expect(await alicePhone.read()).toEqual(['hello alice']);
    expect(await aliceLaptop.read()).toEqual(['hello alice']);
    // Conversation continues with fresh ratchet steps both ways
    for (let i = 0; i < 3; i++) {
      await aliceLaptop.send('dm', false, ['alice', 'bob'], `a${i}`);
      expect(await bob.read()).toEqual([`a${i}`]);
      await bob.send('dm', false, ['alice', 'bob'], `b${i}`);
      expect((await aliceLaptop.read())).toEqual([`b${i}`]);
    }
    expect((await alicePhone.read()).length).toBe(6); // the phone saw all of them too
  });

  it('a packet delivered twice is stored once; one meant for another device is refused', async () => {
    const { server, alicePhone, bob } = await setup();
    await alicePhone.send('dm', false, ['alice', 'bob'], 'once');
    const copy = server.mail.get('bob:1')![0];
    expect(await bob.read()).toEqual(['once']);
    expect((await bob.messenger.receive(copy)).kind).not.toBe('message');
    const elsewhere = { ...copy, packet: { ...copy.packet, to: { user: 'bob', device: 9 } } } as IncomingEnvelope;
    expect((await bob.messenger.receive(elsewhere)).kind).toBe('failed');
  });

  it('edits reach the other side and only move forward', async () => {
    const { server, alicePhone, bob } = await setup();
    const { id } = await alicePhone.send('dm', false, ['alice', 'bob'], 'typo');
    await bob.read();
    server.deliver(alicePhone.address, await alicePhone.messenger.encryptEdit('dm', false, ['alice', 'bob'], id, 2, 'fixed'));
    server.deliver(alicePhone.address, await alicePhone.messenger.encryptEdit('dm', false, ['alice', 'bob'], id, 1, 'older edit'));
    await bob.read();
    expect((await bob.store.message(id))!.text).toBe('fixed');
    expect(bob.inbox.map((r) => r.kind)).toEqual(['message', 'edit', 'duplicate']);
  });

  it('is only ready when everyone has a device list', async () => {
    const server = new Server();
    const alice = await new Device(server, 'alice', 'A').start();
    expect(await alice.messenger.ready(['alice', 'dave'])).toBe(false);
  });
});

describe('groups (sender keys)', () => {
  it('one encryption per message, keys handed out once, removed members cut off', async () => {
    const { server, alicePhone, aliceLaptop, bob, carol } = await setup();
    const members = ['alice', 'bob', 'carol'];
    const first = await bob.send('g', true, members, 'hello group');
    const skdms = first.envelopes.filter((e) => e.packet.kind !== 'skmsg');
    expect(skdms).toHaveLength(3); // alice x2 + carol
    expect(new Set(first.envelopes.filter((e) => e.packet.kind === 'skmsg').map((e) => JSON.stringify(e.packet))).size).toBe(1);
    for (const d of [alicePhone, aliceLaptop, carol]) expect(await d.read()).toEqual(['hello group']);

    const second = await bob.send('g', true, members, 'second');
    expect(second.envelopes.every((e) => e.packet.kind === 'skmsg')).toBe(true); // no new key needed
    for (const d of [alicePhone, carol]) expect(await d.read()).toEqual(['second']);

    // Carol is removed: Bob's next message uses a new key that she never gets
    const third = await bob.send('g', true, ['alice', 'bob'], 'without carol');
    expect(third.envelopes.some((e) => e.to_user === 'carol')).toBe(false);
    const carolCopy = { ...server.mail.get('alice:1')!.find((e) => e.packet.kind === 'skmsg')!, id: 'x' };
    expect((await carol.messenger.receive(carolCopy)).kind).toBe('waiting'); // no key for it
    expect(await alicePhone.read()).toEqual(['without carol']);
  });

  it('a group message that arrives before its key waits, then reads once the key arrives', async () => {
    const { server, bob, carol } = await setup();
    await bob.send('g', true, ['alice', 'bob', 'carol'], 'early');
    const box = server.mail.get('carol:1')!;
    server.mail.set('carol:1', [box[1], box[0]]); // group message first, key second
    // The message waits (stays in the mailbox) until the key is read, then the next pass reads it
    expect(await carol.read()).toEqual(['early']);
    expect(carol.inbox.map((r) => r.kind)).toEqual(['waiting', 'control', 'message']);
    expect(server.mail.get('carol:1')).toEqual([]);
  });
});
