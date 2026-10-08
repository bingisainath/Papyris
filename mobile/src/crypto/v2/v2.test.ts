// Tests for the v2 protocol (docs/encryption-design-v2.md). Shared word for word with mobile.

import {
  Address, b64, certifyDevice, CryptoError, decodeBody, decryptFrom, decryptMedia, decryptMediaChunk, DeviceIdentity, DevicePublic,
  distribution, encodeBody, encryptFor, encryptMedia, fromDistribution, fromGroupPacket, fromMessagePacket, groupDecrypt, groupEncrypt,
  KeyPair, linkCodeV2, linkQrText, loadRatchet, loadSenderKey, MEDIA_CHUNK, MEDIA_HEADER, MediaDecryptor, MediaEncryptor, MessageBody,
  newAccountIdentity, newDeviceIdentity, newLinkOffer, newOneTimePreKeys, newSenderKey, newSignedPreKey, openGrant, pad, padme,
  parseLinkQr, PreKeyBundle, ProtocolStore, publicOneTimePreKeys, publicSignedPreKey, ReplayGuard, safetyNumber, sealGrant,
  SessionRecord, signDeviceList, storeRatchet, storeSenderKey, toGroupPacket, toMessagePacket, unpad, verifyBundle, verifyDeviceList,
  fromUtf8, utf8, unb64, loadDeviceIdentity, storeDeviceIdentity, initSender, initReceiver, ratchetEncrypt, ratchetDecrypt, newX25519,
} from './index';

const expectCode = async (fn: () => unknown, code: string) => {
  try {
    await fn();
  } catch (e) {
    expect(e).toBeInstanceOf(CryptoError);
    expect((e as CryptoError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
};

// ---- a device with in-memory storage, published prekeys and a certificate

class TestDevice implements ProtocolStore {
  identity_: DeviceIdentity = newDeviceIdentity();
  sessions = new Map<string, SessionRecord>();
  spks = new Map<number, KeyPair>();
  opks = new Map<number, KeyPair>();
  publicOpks: { id: number; pub: string }[] = [];
  spkPublic: { id: number; pub: string; sig: string };
  pub!: DevicePublic;

  constructor(public address: Address, aik: KeyPair) {
    const spk = newSignedPreKey(this.identity_, 1);
    this.spks.set(1, spk.key);
    this.spkPublic = publicSignedPreKey(spk);
    const opks = newOneTimePreKeys(100, 5);
    opks.forEach((k) => this.opks.set(k.id, k.key));
    this.publicOpks = publicOneTimePreKeys(opks);
    this.pub = certifyDevice(aik.priv, address.user, address.device,
      { sign: this.identity_.sign.pub, dh: this.identity_.dh.pub, dhSig: this.identity_.dhSig });
  }

  async identity() { return this.identity_; }
  async loadSession(peer: Address) { const r = this.sessions.get(`${peer.user}:${peer.device}`); return r ? JSON.parse(JSON.stringify(r)) : null; }
  async saveSession(peer: Address, record: SessionRecord) { this.sessions.set(`${peer.user}:${peer.device}`, JSON.parse(JSON.stringify(record))); }
  async signedPreKey(id: number) { return this.spks.get(id) || null; }
  async oneTimePreKey(id: number) { return this.opks.get(id) || null; }
  async removeOneTimePreKey(id: number) { this.opks.delete(id); }

  /** What the server hands out: one one-time prekey per request, until they run out. */
  bundle = async (): Promise<PreKeyBundle> => ({
    user: this.address.user, deviceId: this.address.device,
    identitySign: this.pub.sign, identityDh: this.pub.dh, identityDhSig: this.pub.dhSig,
    signedPreKey: this.spkPublic, oneTimePreKey: this.publicOpks.shift() || null,
  });
}

const body = (conv: string, text: string, id = Math.random().toString(36).slice(2)): MessageBody => ({ v: 2, id, conv, ts: Date.now(), kind: 'text', text });

async function send(from: TestDevice, to: TestDevice, conv: string, text: string) {
  const e = await encryptFor(from, to.address, to.pub, encodeBody(body(conv, text)), to.bundle);
  return toMessagePacket(conv, from.address, to.address, e);
}

async function receive(at: TestDevice, from: TestDevice, packet: ReturnType<typeof toMessagePacket>, commit = true) {
  const { plaintext, commit: save } = await decryptFrom(at, from.address, from.pub, fromMessagePacket(JSON.parse(JSON.stringify(packet))));
  if (commit) await save();
  return decodeBody(plaintext, packet.conv).text;
}

describe('identities and device lists', () => {
  const aik = newAccountIdentity();
  const d1 = newDeviceIdentity();
  const d2 = newDeviceIdentity();
  const devices = [d1, d2].map((d, i) => certifyDevice(aik.priv, 'alice', i + 1, { sign: d.sign.pub, dh: d.dh.pub, dhSig: d.dhSig }));
  const list = signDeviceList(aik, 'alice', 3, devices);

  it('accepts a list signed by the pinned account key', () => {
    expect(verifyDeviceList(list, 'alice', aik.pub, 2).map((d) => d.id)).toEqual([1, 2]);
    expect(verifyDeviceList(JSON.parse(JSON.stringify(list)), 'alice').length).toBe(2); // first sight (TOFU)
  });

  it('rejects forged, re-signed, rolled-back or misattributed lists', async () => {
    await expectCode(() => verifyDeviceList({ ...list, version: 4 }, 'alice', aik.pub), 'bad_signature');
    await expectCode(() => verifyDeviceList(list, 'alice', newAccountIdentity().pub), 'bad_signature');
    await expectCode(() => verifyDeviceList(list, 'mallory', aik.pub), 'bad_signature');
    await expectCode(() => verifyDeviceList(list, 'alice', aik.pub, 5), 'replay');
    const other = newAccountIdentity(); // a server-made list with an extra device signed by another key
    const sneaky = signDeviceList(aik, 'alice', 4, [...devices, certifyDevice(other.priv, 'alice', 9, { sign: d1.sign.pub, dh: d1.dh.pub, dhSig: d1.dhSig })]);
    expect(verifyDeviceList(sneaky, 'alice', aik.pub).map((d) => d.id)).toEqual([1, 2]); // the uncertified one is dropped
  });

  it('safety numbers match on both sides and depend on the account keys only', () => {
    const bob = newAccountIdentity();
    const a = safetyNumber({ user: 'alice', aik: aik.pub }, { user: 'bob', aik: bob.pub });
    expect(a).toBe(safetyNumber({ user: 'bob', aik: bob.pub }, { user: 'alice', aik: aik.pub }));
    expect(a).toMatch(/^(\d{5} ){11}\d{5}$/);
    expect(a).not.toBe(safetyNumber({ user: 'alice', aik: aik.pub }, { user: 'bob', aik: newAccountIdentity().pub }));
  });

  it('device identities survive storage', () => {
    const back = loadDeviceIdentity(JSON.parse(JSON.stringify(storeDeviceIdentity(d1))));
    expect(b64(back.dh.priv)).toBe(b64(d1.dh.priv));
  });
});

describe('prekey bundles', () => {
  it('rejects a swapped signed prekey', async () => {
    const bob = new TestDevice({ user: 'bob', device: 1 }, newAccountIdentity());
    const bundle = await bob.bundle();
    expect(() => verifyBundle(bundle)).not.toThrow();
    await expectCode(() => verifyBundle({ ...bundle, signedPreKey: { ...bundle.signedPreKey, pub: b64(newX25519().pub) } }), 'bad_signature');
  });
});

describe('pairwise sessions (X3DH + Double Ratchet)', () => {
  const aliceAik = newAccountIdentity();
  const bobAik = newAccountIdentity();

  it('first messages carry X3DH data until the reply; then plain ratchet messages both ways', async () => {
    const alice = new TestDevice({ user: 'alice', device: 1 }, aliceAik);
    const bob = new TestDevice({ user: 'bob', device: 1 }, bobAik);
    const p1 = await send(alice, bob, 'c1', 'hello');
    const p2 = await send(alice, bob, 'c1', 'are you there');
    expect([p1.kind, p2.kind]).toEqual(['pkmsg', 'pkmsg']);
    expect(p1.pre?.ek).toBe(p2.pre?.ek); // same session
    expect(await receive(bob, alice, p2)).toBe('are you there'); // out of order
    expect(await receive(bob, alice, p1)).toBe('hello');
    expect(bob.opks.has(p1.pre!.opk!)).toBe(false); // one-time prekey used up

    const r1 = await send(bob, alice, 'c1', 'yes');
    expect(r1.kind).toBe('msg');
    expect(await receive(alice, bob, r1)).toBe('yes');
    const p3 = await send(alice, bob, 'c1', 'great');
    expect(p3.kind).toBe('msg'); // Bob answered, so no more X3DH data
    expect(await receive(bob, alice, p3)).toBe('great');

    for (let i = 0; i < 5; i++) {
      expect(await receive(alice, bob, await send(bob, alice, 'c1', `b${i}`))).toBe(`b${i}`);
      expect(await receive(bob, alice, await send(alice, bob, 'c1', `a${i}`))).toBe(`a${i}`);
    }
  });

  it('a replayed or forged packet fails and leaves the session working', async () => {
    const alice = new TestDevice({ user: 'alice', device: 1 }, aliceAik);
    const bob = new TestDevice({ user: 'bob', device: 1 }, bobAik);
    const p1 = await send(alice, bob, 'c1', 'one');
    expect(await receive(bob, alice, p1)).toBe('one');
    await expect(receive(bob, alice, p1)).rejects.toBeInstanceOf(CryptoError); // replay
    const p2 = await send(alice, bob, 'c1', 'two');
    const forged = { ...p2, c: b64(unb64(p2.c).map((x, i) => (i === 3 ? x ^ 1 : x))) };
    await expect(receive(bob, alice, forged)).rejects.toBeInstanceOf(CryptoError);
    expect(await receive(bob, alice, p2)).toBe('two');
  });

  it('nothing is stored until commit, so a failed save can be retried', async () => {
    const alice = new TestDevice({ user: 'alice', device: 1 }, aliceAik);
    const bob = new TestDevice({ user: 'bob', device: 1 }, bobAik);
    const p1 = await send(alice, bob, 'c1', 'keep me');
    expect(await receive(bob, alice, p1, false)).toBe('keep me');
    expect(await receive(bob, alice, p1)).toBe('keep me'); // decryptable again: nothing was saved
  });

  it('messages moved to another conversation are refused', async () => {
    const alice = new TestDevice({ user: 'alice', device: 1 }, aliceAik);
    const bob = new TestDevice({ user: 'bob', device: 1 }, bobAik);
    const p1 = await send(alice, bob, 'c1', 'secret');
    await expectCode(() => receive(bob, alice, { ...p1, conv: 'c2' }), 'replay');
  });

  it('a prekey message from a device that is not the verified one is refused', async () => {
    const alice = new TestDevice({ user: 'alice', device: 1 }, aliceAik);
    const bob = new TestDevice({ user: 'bob', device: 1 }, bobAik);
    const mallory = new TestDevice({ user: 'alice', device: 1 }, newAccountIdentity());
    const p1 = await send(mallory, bob, 'c1', 'hi');
    await expectCode(() => decryptFrom(bob, alice.address, alice.pub, fromMessagePacket(p1)), 'bad_signature');
  });

  it('both sides starting at once still converges', async () => {
    const alice = new TestDevice({ user: 'alice', device: 1 }, aliceAik);
    const bob = new TestDevice({ user: 'bob', device: 1 }, bobAik);
    const fromAlice = await send(alice, bob, 'c1', 'from alice');
    const fromBob = await send(bob, alice, 'c1', 'from bob');
    expect(await receive(bob, alice, fromAlice)).toBe('from alice');
    expect(await receive(alice, bob, fromBob)).toBe('from bob');
    for (let i = 0; i < 3; i++) {
      expect(await receive(bob, alice, await send(alice, bob, 'c1', `a${i}`))).toBe(`a${i}`);
      expect(await receive(alice, bob, await send(bob, alice, 'c1', `b${i}`))).toBe(`b${i}`);
    }
  });

  it('works without one-time prekeys (all used up)', async () => {
    const alice = new TestDevice({ user: 'alice', device: 1 }, aliceAik);
    const bob = new TestDevice({ user: 'bob', device: 1 }, bobAik);
    bob.publicOpks = [];
    const p1 = await send(alice, bob, 'c1', 'no opk');
    expect(p1.pre?.opk).toBeUndefined();
    expect(await receive(bob, alice, p1)).toBe('no opk');
  });

  it('several devices: each gets its own session', async () => {
    const alice = new TestDevice({ user: 'alice', device: 1 }, aliceAik);
    const alicePhone = new TestDevice({ user: 'alice', device: 2 }, aliceAik); // sync copy
    const bobs = [1, 2].map((d) => new TestDevice({ user: 'bob', device: d }, bobAik));
    for (const target of [...bobs, alicePhone]) expect(await receive(target, alice, await send(alice, target, 'c1', 'to all'))).toBe('to all');
  });

  it('ratchet state survives storage mid-conversation', () => {
    const sk = new Uint8Array(32).fill(1);
    const ad = utf8('ad');
    const spk = newX25519();
    const a = initSender(sk, ad, spk.pub);
    let b = initReceiver(sk, ad, spk);
    const m = ratchetEncrypt(a, utf8('x'));
    b = loadRatchet(JSON.parse(JSON.stringify(storeRatchet(b))));
    expect(fromUtf8(ratchetDecrypt(b, m.header, m.ciphertext).plaintext)).toBe('x');
  });

  it('a long gap within the limit works; beyond it fails', async () => {
    const sk = new Uint8Array(32).fill(2);
    const ad = utf8('ad');
    const spk = newX25519();
    const a = initSender(sk, ad, spk.pub);
    const b = initReceiver(sk, ad, spk);
    for (let i = 0; i < 999; i++) ratchetEncrypt(a, utf8('lost'));
    const m = ratchetEncrypt(a, utf8('after the gap'));
    expect(fromUtf8(ratchetDecrypt(b, m.header, m.ciphertext).plaintext)).toBe('after the gap');
    for (let i = 0; i < 1001; i++) ratchetEncrypt(a, utf8('lost'));
    const far = ratchetEncrypt(a, utf8('too far'));
    await expectCode(() => ratchetDecrypt(b, far.header, far.ciphertext), 'too_many_skipped');
  });
});

describe('group messages (sender keys)', () => {
  it('members decrypt in any order; replays, forgeries and moved messages fail', async () => {
    const mine = newSenderKey();
    const theirs = loadSenderKey(JSON.parse(JSON.stringify(storeSenderKey(fromDistribution(distribution(mine))))));
    const sender = 'alice:1';
    const packets = ['zero', 'one', 'two'].map((t) => toGroupPacket('g1', { user: 'alice', device: 1 }, groupEncrypt(mine, 'g1', sender, encodeBody(body('g1', t)))));
    let state = theirs;
    for (const i of [2, 0, 1]) {
      const r = groupDecrypt(state, 'g1', sender, fromGroupPacket(packets[i]));
      state = r.state;
      expect(decodeBody(r.plaintext, 'g1').text).toBe(['zero', 'one', 'two'][i]);
    }
    await expectCode(() => groupDecrypt(state, 'g1', sender, fromGroupPacket(packets[1])), 'replay');
    const next = groupEncrypt(mine, 'g1', sender, encodeBody(body('g1', 'x')));
    await expectCode(() => groupDecrypt(state, 'g2', sender, next), 'bad_signature');
    await expectCode(() => groupDecrypt(state, 'g1', 'bob:1', next), 'bad_signature');
    // A member who only has the public signing key can't forge a message as the sender
    const forger = { ...fromDistribution(distribution(mine)), signPriv: newSenderKey().signPriv };
    await expectCode(() => groupDecrypt(state, 'g1', sender, groupEncrypt(forger, 'g1', sender, utf8('fake'))), 'bad_signature');
  });

  it('a rotated key is a different chain the old one can\'t read', async () => {
    const old = newSenderKey();
    const member = fromDistribution(distribution(old));
    const rotated = newSenderKey();
    await expectCode(() => groupDecrypt(member, 'g', 's', groupEncrypt(rotated, 'g', 's', utf8('new'))), 'no_session');
  });
});

describe('message bodies', () => {
  it('pads to 160-byte steps and unpads', () => {
    expect(pad(utf8('yes')).length).toBe(160);
    expect(pad(new Uint8Array(159)).length).toBe(160);
    expect(pad(new Uint8Array(160)).length).toBe(320);
    expect(fromUtf8(unpad(pad(utf8('héllo'))))).toBe('héllo');
  });

  it('replay guard', () => {
    const g = new ReplayGuard(2);
    expect([g.check('a'), g.check('a'), g.check('b'), g.check('c'), g.check('a')]).toEqual([true, false, true, true, true]);
  });
});

describe('media (PMV2)', () => {
  const sample = (n: number) => new Uint8Array(n).map((_, i) => (i * 13) & 255);
  const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

  it.each([0, 1, 100, MEDIA_CHUNK - 1, MEDIA_CHUNK, MEDIA_CHUNK + 1, 3 * MEDIA_CHUNK + 7])('round-trips %i bytes, padded', (n) => {
    const e = encryptMedia(sample(n));
    expect(e.size).toBe(n);
    expect(e.blob.length).toBeGreaterThanOrEqual(MEDIA_HEADER + padme(n));
    expect(same(decryptMedia(e.blob, e), sample(n))).toBe(true);
  });

  it('streams in odd piece sizes both ways', () => {
    const data = sample(5 * MEDIA_CHUNK + 333);
    const enc = new MediaEncryptor();
    const parts = [enc.start()];
    for (let o = 0; o < data.length; o += 9999) parts.push(...enc.push(data.subarray(o, o + 9999)));
    const done = enc.finish();
    parts.push(...done.chunks);
    const blob = Uint8Array.from(parts.flatMap((p) => Array.from(p)));
    const dec = new MediaDecryptor(done);
    const out: Uint8Array[] = [];
    for (let o = 0; o < blob.length; o += 7777) out.push(...dec.push(blob.subarray(o, o + 7777)));
    out.push(...dec.finish());
    expect(same(Uint8Array.from(out.flatMap((p) => Array.from(p))), data)).toBe(true);
  });

  it('detects changes, truncation and a wrong key', async () => {
    const e = encryptMedia(sample(3 * MEDIA_CHUNK));
    const changed = e.blob.slice();
    changed[MEDIA_HEADER + 5] ^= 1;
    await expectCode(() => decryptMedia(changed, e), 'decrypt_failed');
    await expectCode(() => decryptMedia(e.blob.subarray(0, MEDIA_HEADER + MEDIA_CHUNK + 16), { ...e, sha256: b64(new Uint8Array(32)) }), 'decrypt_failed');
    await expectCode(() => decryptMedia(e.blob, { ...e, key: b64(new Uint8Array(32)) }), 'decrypt_failed');
  });

  it('any chunk decrypts on its own (seeking in videos)', () => {
    const data = sample(3 * MEDIA_CHUNK + 10);
    const e = encryptMedia(data);
    const step = MEDIA_CHUNK + 16;
    const count = Math.ceil((e.blob.length - MEDIA_HEADER) / step);
    const header = e.blob.subarray(0, MEDIA_HEADER);
    const second = decryptMediaChunk(e, header, 1, count, e.blob.subarray(MEDIA_HEADER + step, MEDIA_HEADER + 2 * step));
    expect(same(second, data.subarray(MEDIA_CHUNK, 2 * MEDIA_CHUNK))).toBe(true);
  });

  it('padmé stays within ~12% and grows monotonically', () => {
    let previous = 0;
    for (const n of [2, 10, 1000, 65536, 1234567, 50 * 1024 * 1024]) {
      const p = padme(n);
      expect(p).toBeGreaterThanOrEqual(n);
      expect(p).toBeLessThanOrEqual(Math.ceil(n * 1.125) + 1);
      expect(p).toBeGreaterThanOrEqual(previous);
      previous = p;
    }
  });
});

describe('linking a device', () => {
  it('QR, code and grant: only the new device opens it, for that request only', async () => {
    const identity = newDeviceIdentity();
    const { offer, ek } = newLinkOffer('req-1', identity);
    expect(parseLinkQr(linkQrText(offer))).toEqual(offer);
    expect(parseLinkQr('papyris-link:1:x:y')).toBeNull();
    expect(linkCodeV2(offer)).toMatch(/^[A-Z2-7]{16}$/);
    expect(linkCodeV2({ ...offer, identitySign: newDeviceIdentity().sign.pub })).not.toBe(linkCodeV2(offer)); // code covers the identity too

    const aik = newAccountIdentity();
    const cert = certifyDevice(aik.priv, 'alice', 4, { sign: offer.identitySign, dh: offer.identityDh, dhSig: identity.dhSig });
    const payload = {
      account: { user: 'alice', aik: b64(aik.pub) },
      device: { id: 4, cert: cert.cert, created: cert.created },
      deviceList: signDeviceList(aik, 'alice', 2, [cert]),
      pins: [],
    };
    const grant = sealGrant('req-1', offer.ek, payload);
    const opened = openGrant(JSON.parse(JSON.stringify(grant)), ek);
    expect(verifyDeviceList(opened.deviceList, 'alice', aik.pub).map((d) => d.id)).toEqual([4]);
    await expectCode(() => openGrant({ ...grant, requestId: 'req-2' }, ek), 'decrypt_failed');
    await expectCode(() => openGrant(grant, newX25519()), 'decrypt_failed');
  });
});
