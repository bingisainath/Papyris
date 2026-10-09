// Known-answer tests (phase 7): the published RFC test vectors run through our own wrappers, and fixed
// answers for our KDFs computed independently with Python's `cryptography` package. A changed label,
// a swapped argument or a different library version shows up here.

import { aeadDecrypt, aeadEncrypt, dh, hkdf, kdfCK, kdfRK, messageKeys, seal, sha256, sign, utf8, verify, x25519Public } from './index';
import { ed25519 } from './primitives';

const hex = (s: string) => Uint8Array.from(s.match(/../g)!.map((b) => parseInt(b, 16)));
const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const fill = (n: number, v: number) => new Uint8Array(n).fill(v);

describe('RFC test vectors', () => {
  it('X25519 (RFC 7748 §6.1)', () => {
    const alice = hex('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a');
    const bob = hex('5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb');
    expect(toHex(x25519Public(alice))).toBe('8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a');
    expect(toHex(x25519Public(bob))).toBe('de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f');
    const shared = '4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742';
    expect(toHex(dh(alice, x25519Public(bob)))).toBe(shared);
    expect(toHex(dh(bob, x25519Public(alice)))).toBe(shared);
  });

  it('X25519 refuses low-order points (an all-zero shared secret)', () => {
    expect(() => dh(fill(32, 9), new Uint8Array(32))).toThrow();
  });

  it('Ed25519 (RFC 8032 §7.1, test 1)', () => {
    const sk = hex('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60');
    expect(toHex(ed25519.getPublicKey(sk))).toBe('d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a');
    const sig = sign(sk, new Uint8Array());
    expect(toHex(sig)).toBe('e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b');
    expect(verify(ed25519.getPublicKey(sk), new Uint8Array(), sig)).toBe(true);
    expect(verify(ed25519.getPublicKey(sk), Uint8Array.of(0), sig)).toBe(false);
  });

  it('HKDF-SHA256 (RFC 5869, test case 1)', () => {
    const okm = hkdf(sha256, fill(22, 0x0b), hex('000102030405060708090a0b0c'), hex('f0f1f2f3f4f5f6f7f8f9'), 42);
    expect(toHex(okm)).toBe('3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865');
  });

  it('ChaCha20-Poly1305 (RFC 8439 §2.8.2)', () => {
    const key = Uint8Array.from({ length: 32 }, (_, i) => 0x80 + i);
    const nonce = hex('070000004041424344454647');
    const ad = hex('50515253c0c1c2c3c4c5c6c7');
    const plain = utf8("Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.");
    const sealed = aeadEncrypt(key, nonce, plain, ad);
    expect(toHex(sealed)).toBe(
      'd31a8d34648e60db7b86afbc53ef7ec2a4aded51296e08fea9e2b5a736ee62d63dbea45e8ca9671282fafb69da92728b1a71de0a9e060b2905d6a5b67ecd3b3692ddbd7f2d778b8c9803aee328091b58fab324e4fad675945585808b4831d7bc3ff4def08e4b7a9de576d26586cec64b6116'
      + '1ae10b594f09e26a7e902ecbd0600691',
    );
    expect(toHex(aeadDecrypt(key, nonce, sealed, ad))).toBe(toHex(plain));
  });
});

describe("our KDFs (answers computed independently in Python)", () => {
  it('root chain, chain step, message keys and sealing', () => {
    const [rk, ck] = kdfRK(fill(32, 1), fill(32, 2));
    expect([toHex(rk), toHex(ck)]).toEqual([
      'f1263ff28d54c89cbd54d27dd81701d57f311f0128d37a7f4d407c944485ffed',
      '95c622c9d3a514d18eb676d00e28cc4bb7e36f4a31b6951ccbda8b62c71f3495',
    ]);
    const [next, mk] = kdfCK(fill(32, 3));
    expect([toHex(next), toHex(mk)]).toEqual([
      'cfbf8f5595e5f186a92161efb3ebb946d3aa706c2df70eed5152741bdb1e7bde',
      'aa6fa3f949be2b2cc7de5a18e7f65fee5fb78488f588d53196a63e66ad67ad12',
    ]);
    const keys = messageKeys(fill(32, 4));
    expect([toHex(keys.key), toHex(keys.nonce)]).toEqual(['707190ef023f8fd15275de36a61dccd0bf98b7d0a5aa568ab598458b60c93502', '893d7a14ba1ec03fb1febb62']);
    expect(toHex(seal(fill(32, 4), utf8('hello'), utf8('ad')))).toBe('9ebe07b498e93d824cfdf0970c34f37b0f1279d8be');
  });
});
