import {
  decryptFile, E2EError, encryptFile, encryptedSize, FILE_CHUNK, formatLinkCode, fromBase64, fromUtf8, generateKeys, isEncryptedText,
  jpegOrientation, keysFromSecret, keysToSecret, linkCode, linkQrText, newLinkKey, normalizeLinkCode, openKeysFromDevice, openMessage,
  parseLinkQr, publicKeysOf, sealKeysForDevice, sealMessage, securityCode, stripJpegMetadata, toBase64, utf8,
} from './e2e';

const alice = { id: 'a1', keys: generateKeys() };
const bob = { id: 'b2', keys: generateKeys() };
const eve = { id: 'e3', keys: generateKeys() };
const to = (...people: typeof alice[]) => people.map((p) => ({ userId: p.id, enc: publicKeysOf(p.keys).enc }));
const ctx = { conversationId: 'c1', senderId: alice.id };

const expectCode = (fn: () => unknown, code: string) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(E2EError);
    expect((e as E2EError).code).toBe(code);
    return;
  }
  throw new Error('expected an error');
};

describe('messages', () => {
  const sealed = sealMessage({ t: 'Hello Bob 👋 – ünïcode' }, ctx, to(alice, bob), alice.keys);

  it('every recipient (including the sender) can read it', () => {
    expect(isEncryptedText(sealed)).toBe(true);
    expect(sealed).not.toContain('Hello');
    for (const who of [alice, bob]) {
      const opened = openMessage(sealed, { ...ctx, myId: who.id }, who.keys);
      expect(opened.payload.t).toBe('Hello Bob 👋 – ünïcode');
      expect(opened.senderSignKey).toBe(publicKeysOf(alice.keys).sign);
    }
  });

  it('someone it was not sealed for cannot read it', () => {
    expectCode(() => openMessage(sealed, { ...ctx, myId: eve.id }, eve.keys), 'not_a_recipient');
    // even pretending to be Bob, with the wrong private key
    expectCode(() => openMessage(sealed, { ...ctx, myId: bob.id }, eve.keys), 'not_a_recipient');
  });

  it('detects changes, moving to another chat and a different claimed sender', () => {
    const env = JSON.parse(sealed.slice(5));
    const flipped = { ...env, c: toBase64(fromBase64(env.c).map((b: number, i: number) => (i === 3 ? b ^ 1 : b))) };
    expectCode(() => openMessage('e2e1:' + JSON.stringify(flipped), { ...ctx, myId: bob.id }, bob.keys), 'bad_signature');
    expectCode(() => openMessage(sealed, { conversationId: 'other', senderId: alice.id, myId: bob.id }, bob.keys), 'bad_signature');
    expectCode(() => openMessage(sealed, { ...ctx, senderId: eve.id, myId: bob.id }, bob.keys), 'bad_signature');
    // removing a recipient's key also breaks the signature
    const rest = { ...env.k };
    delete rest.b2;
    expectCode(() => openMessage('e2e1:' + JSON.stringify({ ...env, k: rest }), { ...ctx, myId: alice.id }, alice.keys), 'bad_signature');
  });

  it('a forger without the sender key cannot sign as them', () => {
    const forged = sealMessage({ t: 'pay me' }, ctx, to(alice, bob), eve.keys);
    // It opens, but signed with Eve's key: the app compares senderSignKey with Alice's known keys
    expect(openMessage(forged, { ...ctx, myId: bob.id }, bob.keys).senderSignKey).not.toBe(publicKeysOf(alice.keys).sign);
  });
});

describe('account keys', () => {
  it('a new device gets the keys by linking, and nobody else can open them', () => {
    const device = newLinkKey();
    const sealed = sealKeysForDevice(alice.keys, device.publicKey, 'req-1');
    expect(publicKeysOf(openKeysFromDevice(sealed, device.privateKey, 'req-1'))).toEqual(publicKeysOf(alice.keys));
    expect(JSON.stringify(sealed)).not.toContain(toBase64(alice.keys.encPrivate));
    expect(() => openKeysFromDevice(sealed, newLinkKey().privateKey, 'req-1')).toThrow(E2EError); // another device
    expect(() => openKeysFromDevice(sealed, device.privateKey, 'req-2')).toThrow(E2EError); // replayed to another request
  });

  it('link QR and code', () => {
    const device = newLinkKey();
    const qr = linkQrText('0b6f-id', device.publicKey);
    expect(parseLinkQr(qr)).toEqual({ requestId: '0b6f-id', publicKey: device.publicKey });
    expect(parseLinkQr('https://example.com')).toBeNull();
    // Same code as the server (base32 of SHA-256, 16 characters)
    expect(linkCode(new Uint8Array(32).map((_, i) => i))).toBe('MMG42KLGYQZWNEIS');
    expect(formatLinkCode('MMG42KLGYQZWNEIS')).toBe('MMG4-2KLG-YQZW-NEIS');
    expect(normalizeLinkCode(' mmg4-2klg yqzw-neis ')).toBe('MMG42KLGYQZWNEIS');
  });

  it('round-trips through the 64-byte secret kept on the device', () => {
    expect(publicKeysOf(keysFromSecret(keysToSecret(bob.keys)))).toEqual(publicKeysOf(bob.keys));
  });

  it('security code is the same from both sides and changes with a key', () => {
    const a = { userId: alice.id, keys: publicKeysOf(alice.keys) };
    const b = { userId: bob.id, keys: publicKeysOf(bob.keys) };
    expect(securityCode(a, b)).toBe(securityCode(b, a));
    expect(securityCode(a, b)).toMatch(/^(\d{5} ){11}\d{5}$/);
    expect(securityCode(a, { userId: bob.id, keys: publicKeysOf(eve.keys) })).not.toBe(securityCode(a, b));
  });
});

describe('files', () => {
  const key = new Uint8Array(32).fill(7);
  it.each([0, 1, FILE_CHUNK - 1, FILE_CHUNK, FILE_CHUNK + 1, 3 * FILE_CHUNK + 5])('round-trips %i bytes', (size) => {
    const data = new Uint8Array(size).map((_, i) => (i * 31) & 255);
    const enc = encryptFile(key, data);
    expect(enc.length).toBe(encryptedSize(size));
    expect(decryptFile(key, enc)).toEqual(data);
  });

  it('detects truncation, reordering and the wrong key', () => {
    const data = new Uint8Array(2 * FILE_CHUNK + 10).fill(1);
    const enc = encryptFile(key, data);
    expectCode(() => decryptFile(key, enc.subarray(0, 16 + FILE_CHUNK + 16)), 'tampered'); // cut after a full chunk
    expectCode(() => decryptFile(new Uint8Array(32), enc), 'tampered');
    const swapped = new Uint8Array(enc);
    const a = enc.subarray(16, 16 + FILE_CHUNK + 16);
    const b = enc.subarray(16 + FILE_CHUNK + 16, 16 + 2 * (FILE_CHUNK + 16));
    swapped.set(b, 16);
    swapped.set(a, 16 + FILE_CHUNK + 16);
    expectCode(() => decryptFile(key, swapped), 'tampered');
  });
});

describe('helpers', () => {
  const Buffer = (globalThis as any).Buffer; // Node's, to compare against
  it('base64 and utf8 match the platform', () => {
    const bytes = new Uint8Array(1000).map((_, i) => (i * 7) & 255);
    for (const n of [0, 1, 2, 3, 4, 999, 1000]) {
      expect(toBase64(bytes.subarray(0, n))).toBe(Buffer.from(bytes.subarray(0, n)).toString('base64'));
      expect(fromBase64(Buffer.from(bytes.subarray(0, n)).toString('base64'))).toEqual(bytes.subarray(0, n));
    }
    expect(fromUtf8(utf8('a€😀'))).toBe('a€😀');
  });

  it('strips EXIF from JPEGs and reads the orientation first', () => {
    // SOI, APP1 Exif (big-endian TIFF, one IFD entry: orientation 6), APP0, SOS + data
    const tiff = [0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0];
    const exifBody = [...Array.from(utf8('Exif')), 0, 0, ...tiff];
    const app1 = [0xff, 0xe1, 0, exifBody.length + 2, ...exifBody];
    const app0 = [0xff, 0xe0, 0, 4, 1, 2];
    const jpeg = new Uint8Array([0xff, 0xd8, ...app1, ...app0, 0xff, 0xda, 9, 9, 9]);
    expect(jpegOrientation(jpeg)).toBe(6);
    expect(Array.from(stripJpegMetadata(jpeg))).toEqual([0xff, 0xd8, ...app0, 0xff, 0xda, 9, 9, 9]);
    const png = new Uint8Array([0x89, 0x50]);
    expect(stripJpegMetadata(png)).toBe(png);
  });
});
