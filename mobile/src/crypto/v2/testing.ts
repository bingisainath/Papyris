// Test helpers for v2 (not part of the apps): an in-memory server with the backend's rules, and
// devices that talk to it.

import {
  Address, DeviceList, DeviceManager, E2EHttp, EncryptedStore, IncomingEnvelope, MemoryKV, Messenger,
  MessageBody, OutgoingEnvelope, PreKeyBundle, Received, unb64, verify, verifyDeviceList, linkCodeV2,
} from './index';

/** An in-memory v2 server: devices, prekeys, signed lists, mailboxes (rules as in the backend). */
export class Server {
  devices = new Map<string, { sign: string; dh: string; dhSig: string }>();
  spk = new Map<string, { id: number; pub: string; sig: string }>();
  opks = new Map<string, { id: number; pub: string }[]>();
  lists = new Map<string, DeviceList>();
  next = new Map<string, number>();
  mail = new Map<string, IncomingEnvelope[]>();
  links = new Map<string, { id: string; user: string; device_id: number; ek: string; code: string; grant?: unknown }>();
  removed = new Set<string>();
  seq = 0;

  private linkView(r: { id: string; user: string; device_id: number; ek: string; code: string }) {
    const d = this.devices.get(`${r.user}:${r.device_id}`)!;
    return { id: r.id, device_id: r.device_id, name: 'New device', ek: r.ek, sign: d.sign, dh: d.dh, dhSig: d.dhSig, code: r.code, expires_at: '' };
  }

  http(user: string): E2EHttp {
    const fail = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });
    return {
      get: async <T,>(path: string, params?: Record<string, unknown>): Promise<T> => {
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
        if (path === '/e2e/v2/devices/me') {
          return { devices: [...this.devices].filter(([k]) => k.startsWith(`${user}:`) && !this.removed.has(k)).map(([k, d]) => ({ device_id: Number(k.split(':')[1]), ...d })) } as T;
        }
        if (path === '/e2e/v2/link-requests') {
          const r = [...this.links.values()].find((x) => x.user === user && x.code === params?.code && !x.grant);
          if (!r) throw fail(404);
          return this.linkView(r) as T;
        }
        m = path.match(/^\/e2e\/v2\/link-requests\/([^/]+)$/);
        if (m) {
          const r = this.links.get(m[1]);
          if (!r || r.user !== user) throw fail(404);
          if (!r.grant) return { ...this.linkView(r), status: 'waiting' } as T;
          this.links.delete(m[1]); // handed over once
          return { ...this.linkView(r), status: 'approved', grant: JSON.parse(JSON.stringify(r.grant)) } as T;
        }
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
        if (path === '/e2e/v2/link-requests') {
          const d = this.devices.get(`${user}:${body.device_id}`)!;
          const id = `req-${++this.seq}`;
          this.links.set(id, { id, user, device_id: body.device_id, ek: body.ek, code: linkCodeV2({ ek: unb64(body.ek), identitySign: unb64(d.sign), identityDh: unb64(d.dh) }) });
          return this.linkView(this.links.get(id)!) as T;
        }
        const g = path.match(/^\/e2e\/v2\/link-requests\/([^/]+)\/grant$/);
        if (g) {
          const r = this.links.get(g[1]);
          if (!r || r.user !== user) throw fail(404);
          if (r.grant) throw fail(409);
          r.grant = body.grant;
          return {} as T;
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
          const list: DeviceList = body.device_list;
          verifyDeviceList(list, user);
          const current = this.lists.get(user);
          if (current && current.aik !== list.aik && !body.replace) throw fail(409);
          if (current && current.aik === list.aik && list.version <= current.version) throw fail(409);
          for (const d of list.devices) {
            const r = this.devices.get(`${user}:${d.id}`);
            if (!r || this.removed.has(`${user}:${d.id}`) || r.sign !== d.sign || r.dh !== d.dh) throw fail(422);
          }
          this.lists.set(user, list);
          return {} as T;
        }
        throw fail(404);
      },
      del: async <T,>(path: string): Promise<T> => {
        const m = path.match(/^\/e2e\/v2\/devices\/(\d+)$/);
        if (m) this.removed.add(`${user}:${m[1]}`);
        return {} as T;
      },
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

export class Device {
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
