# Papyris end-to-end encryption, version 2: Signal-level design

Status: proposal. Version 1 (what's built: `web/src/crypto/e2e.ts`, shared with mobile) stays in
place until this is implemented and audited.

This document:

1. reviews the current model (version 1) and lists its weaknesses;
2. proposes a design with the same properties as Signal and WhatsApp: X3DH session setup, the
   Double Ratchet for direct chats, Sender Keys for groups, per-device identities certified by an
   account key, and encrypted history transfer for linked devices;
3. gives exact packet formats and TypeScript you can build on.

Primitives (all from `@noble/curves`, `@noble/hashes` and `@noble/ciphers`, which the apps already use):

| Purpose | Primitive |
|---|---|
| Key agreement | X25519 |
| Signatures (identities, prekeys, device certificates, group messages) | Ed25519 |
| Key derivation | HKDF-SHA256, HMAC-SHA256 (chain keys) |
| Encryption | ChaCha20-Poly1305 (12-byte nonce) for derived-key messages; XChaCha20-Poly1305 (24-byte nonce) only where a random nonce is needed |

**Why ChaCha20-Poly1305 rather than AES-256-GCM.** Both are fine AEADs with 256-bit keys. AES-GCM
is only fast and constant-time with hardware AES instructions, which pure-JavaScript code in
browsers and React Native (Hermes) can't use. A JS AES leaks timing through table lookups and is
several times slower. ChaCha20 is pure add-rotate-xor: constant-time and fast in software. It is
also what WireGuard, TLS 1.3 on phones and libsodium default to. If you later move file
encryption into native code (AES instructions available), AES-256-GCM drops into the same chunk
format: same key size, nonce size and tag size.

---

## 1. Review of the current model (version 1)

How it works today:
- **Keys:** one account key pair, X25519 for encryption and Ed25519 for signing, created on the
  first device and copied to every linked device.
- **Messages:** each message is encrypted with a fresh random key (XChaCha20-Poly1305). That key is
  wrapped for every member through ephemeral-static X25519 against their long-term key, and the
  envelope is signed with Ed25519.
- **Files:** chunked XChaCha20-Poly1305 with a random file key.

What's good and should be kept:
- per-message random content keys;
- a signature bound to the conversation and the sender;
- chunked file encryption with numbered chunks and a final-chunk flag, so files can't be
  reordered or cut short;
- device linking through a QR code that carries the new device's key.

Weaknesses, most serious first:

| # | Weakness | Consequence | Fix in v2 |
|---|---|---|---|
| W1 | **No forward secrecy.** Every message key is wrapped to the recipient's *long-term* X25519 key, and the server keeps every ciphertext indefinitely. | Anyone who later gets one device's key (theft, malware, a seized phone) can decrypt **all past messages** to that account from server copies. | Double Ratchet: message keys come from ephemeral DH and are deleted after use; past ciphertexts become useless (§4). |
| W2 | **No post-compromise security.** The same key is used forever. | An attacker who copies the key once reads all future traffic silently. | DH ratchet steps on every round trip "heal" the session (§4). |
| W3 | **One identity shared by all devices.** Linking copies the private keys. | A compromise of the weakest device (a browser profile) is a compromise of every device; a device can't be removed without a full reset. | Per-device identity keys, certified by an account identity key that stays on the primary device (§3). |
| W4 | **No key pinning.** Apps fetch public keys from the server each time; "previous keys" also come from the server. | A malicious server can swap or add a key for new messages and pass the "unverified sender" check. The security code helps only if people compare it. | Trust on first use: pin each contact's account identity key locally and show "Security code changed" in the chat when it changes (§3.4). Device lists are signed by the account key, so the server can't add devices. |
| W5 | **Replay and rollback.** The signed data doesn't include a message id or edit version. | The server can replay an old envelope as a new message, or put an older version of an edited message back. | Each plaintext carries a unique message id, the conversation id and an edit counter; receivers keep a replay window (§6.1). |
| W6 | **Message length leaks.** Ciphertext length equals text length. | Short replies ("yes"/"no") can be told apart by size. | Pad plaintexts to 160-byte buckets (§6.1), and media to Padmé sizes (§7). |
| W7 | **Deterministic zero nonce on key wraps.** It's safe only because every wrap key is unique. | Brittle: any future code that reuses an ephemeral key across wraps would reuse a nonce. | Wraps go away. Ratchet keys derive key and nonce together, used once (§4.2). |
| W8 | **Signatures make messages non-repudiable.** Anyone holding a message can prove to a third party who wrote it. | Not a confidentiality issue, but Signal deliberately avoids it. | Direct chats authenticate through the ratchet (symmetric MACs, deniable). Groups keep a per-sender signature as Signal does, but with a sender-key signing key that isn't the identity key. |
| W9 | **Group membership changes don't rotate anything.** | A removed member who still has old envelopes is fine; but nothing forces future secrecy against them. Today's per-message wrapping happens to handle this, but it costs O(members) per message. | Sender Keys, rotated by every remaining member on removal (§5). |
| W10 | **File keys live in server-stored envelopes forever.** | Combined with W1, a leaked account key also opens every photo and video. | File keys travel only inside ratchet messages, which can't be decrypted later (§7). |

What v2 doesn't change: who talks to whom and when is visible to the server (Signal's "sealed
sender" hides the sender from the server and could be a later step). Expenses and receipt scans
stay server-readable by design.

---

## 2. Keys at a glance

| Key | Type | Where it lives | Lifetime | Purpose |
|---|---|---|---|---|
| **Account identity key (AIK)** | Ed25519 | Primary device only (the phone) | Until "start fresh" | Signs the account's device list and device certificates. Safety numbers are computed from it. |
| **Device identity key (DIK)** | Ed25519 + X25519 pair (the X25519 half signed by the Ed25519 half) | Each device | Life of the device's sign-in | X3DH identity; signs prekeys. |
| **Signed prekey (SPK)** | X25519, signed by DIK | Device; public half on the server | Rotated every 7 days; old private kept 30 days | X3DH; Bob's initial ratchet key. |
| **One-time prekeys (OPK)** | X25519 | Device; public halves on the server (100 at a time) | Deleted when used | Extra forward secrecy for the first message. |
| **Root key / chain keys** | 32 bytes | Device, per session | Change every message / round trip | Double Ratchet. |
| **Message key** | 32 bytes → (key, nonce) | Device, used once | Deleted after one message | Encrypts one message. |
| **Sender key** (groups) | Chain key 32 bytes + Ed25519 signing key | Each sender device, per group | Rotated on membership change, every 7 days or 1,000 messages | Encrypts one sender's group messages. |
| **File key** | 32 bytes random | Inside the message that references the file | Per file | Encrypts one photo, video, voice note, document or thumbnail. |
| **History key** | 32 bytes random | Inside one device-link grant | One transfer | Encrypts a history bundle for a new device. |
| **Local storage key** | AES/ChaCha key in Keychain/Keystore (phone) or non-extractable WebCrypto key (web) | Device | Device | Encrypts the local message database at rest. |

---

## 3. Identities, devices and linking

### 3.1 Why per-device keys plus an account key

Signal and WhatsApp give every device its own identity, because:
- a stolen laptop can be unlinked;
- one device's compromise doesn't hand over the others' keys (W3).

The contact still needs **one** stable thing to verify (the security code). So the account key
signs the list of devices; contacts pin the account key and accept any device it signs.

**As built (phase 5):** like Signal's linked devices, every device of the account holds the account
key. It travels only inside the link grant, encrypted for the new device alone, so any of your devices
can link the next one, and losing the first device doesn't force a fresh start. The trade-off: a
compromised device can certify new devices until it's noticed (W3 still holds for message keys, which
stay per device). The original WhatsApp-style plan, where only the first device holds the key and
others get just a certificate, is kept below for reference.

### 3.2 Device certificate and signed device list

```text
DeviceCert  = Ed25519_Sign(AIK_priv,
                "PapyrisDeviceCert.v2" || u16(len(userId)) || userId || u32be(deviceId)
                || DIK_sign_pub(32) || DIK_dh_pub(32) || u64be(createdAtMs))

DeviceList  = { user, version(u32, strictly increasing), devices: [ {id, sign, dh, created, cert} ] }
ListSig     = Ed25519_Sign(AIK_priv, "PapyrisDeviceList.v2" || canonicalJson(DeviceList))
```

Senders verify `ListSig` with the **pinned** AIK of the contact. They encrypt to exactly the devices
in the highest-versioned valid list, and reject a list whose version goes backwards (rollback).

### 3.3 Linking a device (device-to-device key transfer)

```text
New device (N)                                   Primary (P)                         Server
-------------                                    -----------                         ------
gen DIK_N (sign+dh), EK_N (X25519, one-off)
POST /devices/link-requests {ek, dik_sign, dik_dh, dik_sig, name} ------------------->  stores, returns reqId
show QR: papyris-link:2:<reqId>:<ek>:<dik_sign>:<dik_dh>
                                                 scan QR, GET request by reqId  <------
                                                 check QR keys == server's copy
                                                 user confirms "Link Chrome on Mac?"
                                                 cert = Sign(AIK, N's keys)
                                                 new DeviceList v+1, signed
                                                 build history bundle (§3.5)
                                                 EK_P one-off; K = HKDF(DH(EK_P, EK_N))
                                                 grant = AEAD_K(payload)
                                                 POST grant + new signed list ------> stores; WS "device_linked"
GET grant (once, then deleted) <---------------------------------------------------------
K = HKDF(DH(EK_N, EK_P)); open grant
verify cert & list with AIK from grant == the
account key this user already sees for themself
upload SPK + 100 OPKs; start receiving
```

Why the transfer is safe:
- **No swapped keys.** The QR carries N's one-off key *and* its identity keys, so the server can't
  substitute either: P certifies exactly the keys it scanned. The typed 16-character code is the
  fallback. It's 80 bits of `SHA-256(ek || dik_sign || dik_dh)`, too long to forge by trying
  random keys (2^80 work).
- **Encrypted for one device only.** The grant is encrypted under ephemeral-ephemeral X25519.
  Only N's one-off key can open it, and both one-off keys are deleted afterwards, so a later
  device compromise can't reopen a recorded grant.
- **No long-term secrets travel.** The grant carries a certificate, a signed list and a
  history key. AIK and other devices' keys never leave their device.
- **Limited scope.** Requests expire in 10 minutes, are tied to the signed-in account, and P
  always asks for confirmation.

### 3.4 Pinning and key-change notices

- The first time the app sees a contact's AIK, it stores it (TOFU).
- If a later device list is signed by a *different* AIK (the contact started fresh), the app
  accepts it but:
  - posts a local notice in the chat: "Alice's security code changed";
  - if the contact was **verified**, holds outgoing messages until the user taps "Accept".
- Safety number = the existing `securityCode()` computed over the two **AIK** public keys (not
  device keys), so linking a device never changes it.

### 3.5 Old messages on a newly linked device, without the server seeing them

Ratchet keys are single-use and deleted, so a new device **can't** decrypt old server ciphertexts.
That's the point of forward secrecy. Instead, the primary sends the *plaintext history* end to end:

1. P exports its local message database for the chosen range (all of it, or the last N days) as
   records: `{conv, id, sender, ts, type, text, media pointers (with file keys), edits, reactions}`.
2. P generates a random 32-byte **history key**, compresses the export, and encrypts it with the
   media format (§7). Then it uploads the blob like any encrypted file: the server sees an opaque
   `.enc` blob.
3. The history key, blob URL and blob SHA-256 go **inside the link grant**, which only N can open.
4. N downloads the blob, verifies the hash, decrypts it and imports it into its local database.
   Photos and videos referenced in the history stay on the server, encrypted with their own file
   keys, which are inside the history.

The server sees one opaque blob and its size. The keys that unlock it travel only
device-to-device. This is how WhatsApp's "history sync" for linked devices works.

---

## 4. Direct chats: X3DH + Double Ratchet

### 4.1 Session setup (X3DH)

Alice's device wants to talk to Bob's device `d`. It fetches Bob's **prekey bundle** for `d`:
`{DIK_sign, DIK_dh, DIK_dh_sig, SPK{id, pub, sig}, OPK{id, pub}?}`. The server hands out each OPK
once.

```text
verify DIK_dh_sig and SPK.sig with DIK_sign; verify DIK_* against Bob's signed device list
EK_A  = fresh X25519
DH1 = X25519(IKdh_A, SPK_B)      authenticates Alice (only she has IKdh_A)
DH2 = X25519(EK_A,  IKdh_B)      authenticates Bob
DH3 = X25519(EK_A,  SPK_B)       forward secrecy (SPK rotates)
DH4 = X25519(EK_A,  OPK_B)       one-time forward secrecy (if an OPK was available)
SK  = HKDF(salt = 0x00*32, ikm = 0xFF*32 || DH1 || DH2 || DH3 || DH4, info = "PapyrisX3DH.v2", 32)
AD  = "PapyrisAD.v2" || DIK_sign_A || DIK_dh_A || DIK_sign_B || DIK_dh_B
```

The leading 32 bytes of `0xFF` are Signal's domain separator for X25519 in X3DH. `AD` binds both
identities into every message of the session, so a message can't be replayed into a session with
a different party.

### 4.2 Key derivation (the three KDFs)

```text
KDF_RK(rk, dh_out) = HKDF(salt = rk, ikm = dh_out, info = "PapyrisRatchet.v2", 64)  -> (rk', ck)
KDF_CK(ck)         = mk = HMAC-SHA256(ck, 0x01);  ck' = HMAC-SHA256(ck, 0x02)
MSG_KEYS(mk)       = HKDF(salt = 0x00*32, ikm = mk, info = "PapyrisMessageKeys.v2", 44)
                     -> key (32) || nonce (12)                        for ChaCha20-Poly1305
```

- **HKDF for the root chain:** it mixes fresh DH output with the previous root (extract-then-expand).
- **HMAC for the symmetric chains:** a one-way step per message. Knowing `ck'` doesn't reveal
  `mk` or `ck`: that's forward secrecy *within* a chain.
- **Nonce derived with the key:** each message key is used exactly once, so a derived
  (deterministic) nonce can't repeat under the same key. Random nonces aren't needed, and a weak
  random source can't cause a nonce collision.

### 4.3 Message keys: one key for everything, per chat, or per message?

| Option | Verdict | Why |
|---|---|---|
| One key for all messages | **No** | Any leak reveals everything, past and future. Random nonces under one key start colliding after about 2^32 messages with 12-byte nonces. There's no way to remove a member or a device. |
| One key per chat | **No** | The same problems scaled down: no forward secrecy or post-compromise security, and every removed member keeps the key. This is roughly what version 1 adds up to over time (W1). |
| **One key per message, derived from a ratchet** | **Yes** | Each key encrypts one message and is deleted. Chains move forward one-way (forward secrecy). New DH material arrives every round trip (post-compromise security). Keys come from chains, not stored random values, so nothing long-lived exists to steal. |

Groups also use one key per message, from each sender's own chain (§5).

### 4.4 TypeScript: primitives and X3DH

```ts
// crypto/v2/primitives.ts
import { ed25519, x25519 } from '@noble/curves/ed25519';
import { chacha20poly1305 } from '@noble/ciphers/chacha';
import { hkdf } from '@noble/hashes/hkdf';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';
import { concatBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils';

export const ZERO32 = new Uint8Array(32);
export const u32be = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n); return b; };
export const u64be = (n: number) => { const b = new Uint8Array(8); const v = new DataView(b.buffer); v.setUint32(0, Math.floor(n / 2 ** 32)); v.setUint32(4, n >>> 0); return b; };
export const eq = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

export interface KeyPair { priv: Uint8Array; pub: Uint8Array }
export const newX25519 = (): KeyPair => { const priv = x25519.utils.randomPrivateKey(); return { priv, pub: x25519.getPublicKey(priv) }; };
export const newEd25519 = (): KeyPair => { const priv = ed25519.utils.randomPrivateKey(); return { priv, pub: ed25519.getPublicKey(priv) }; };

/** X25519 that refuses low-order points (an all-zero result means the peer sent a bad key). */
export function dh(priv: Uint8Array, pub: Uint8Array): Uint8Array {
  const out = x25519.getSharedSecret(priv, pub);
  if (out.every((b: number) => b === 0)) throw new Error('Invalid public key');
  return out;
}

export function kdfRK(rk: Uint8Array, dhOut: Uint8Array): [Uint8Array, Uint8Array] {
  const okm = hkdf(sha256, dhOut, rk, utf8ToBytes('PapyrisRatchet.v2'), 64);
  return [okm.slice(0, 32), okm.slice(32)];
}

export function kdfCK(ck: Uint8Array): [next: Uint8Array, mk: Uint8Array] {
  return [hmac(sha256, ck, Uint8Array.of(2)), hmac(sha256, ck, Uint8Array.of(1))];
}

export function messageKeys(mk: Uint8Array): { key: Uint8Array; nonce: Uint8Array } {
  const okm = hkdf(sha256, mk, ZERO32, utf8ToBytes('PapyrisMessageKeys.v2'), 44);
  return { key: okm.slice(0, 32), nonce: okm.slice(32, 44) };
}

export const seal = (mk: Uint8Array, pt: Uint8Array, ad: Uint8Array) => { const k = messageKeys(mk); return chacha20poly1305(k.key, k.nonce, ad).encrypt(pt); };
export const open = (mk: Uint8Array, ct: Uint8Array, ad: Uint8Array) => { const k = messageKeys(mk); return chacha20poly1305(k.key, k.nonce, ad).decrypt(ct); };
export { concatBytes, randomBytes, utf8ToBytes, ed25519, sha256, hkdf };
```

```ts
// crypto/v2/x3dh.ts
import { concatBytes, dh, ed25519, hkdf, KeyPair, newX25519, sha256, utf8ToBytes, ZERO32 } from './primitives';

export interface DeviceIdentity { sign: KeyPair; dh: KeyPair; dhSig: Uint8Array } // dhSig = Sign(sign.priv, dh.pub)
export interface PreKeyBundle {
  deviceId: number;
  identitySign: Uint8Array; identityDh: Uint8Array; identityDhSig: Uint8Array;
  signedPreKey: { id: number; pub: Uint8Array; sig: Uint8Array };
  oneTimePreKey?: { id: number; pub: Uint8Array };
}

const F = new Uint8Array(32).fill(0xff);
const INFO = utf8ToBytes('PapyrisX3DH.v2');

export const associatedData = (aSign: Uint8Array, aDh: Uint8Array, bSign: Uint8Array, bDh: Uint8Array) =>
  concatBytes(utf8ToBytes('PapyrisAD.v2'), aSign, aDh, bSign, bDh);

/** Alice: start a session with one of Bob's devices. The bundle's identity must already be checked against Bob's signed device list. */
export function x3dhInitiate(me: DeviceIdentity, bundle: PreKeyBundle) {
  if (!ed25519.verify(bundle.identityDhSig, bundle.identityDh, bundle.identitySign)) throw new Error('Bad identity');
  if (!ed25519.verify(bundle.signedPreKey.sig, bundle.signedPreKey.pub, bundle.identitySign)) throw new Error('Bad signed prekey');
  const ek = newX25519();
  const parts = [
    F,
    dh(me.dh.priv, bundle.signedPreKey.pub),
    dh(ek.priv, bundle.identityDh),
    dh(ek.priv, bundle.signedPreKey.pub),
    ...(bundle.oneTimePreKey ? [dh(ek.priv, bundle.oneTimePreKey.pub)] : []),
  ];
  const sk = hkdf(sha256, concatBytes(...parts), ZERO32, INFO, 32);
  parts.slice(1).forEach((p) => p.fill(0)); // wipe the DH outputs (not the shared F constant)
  const ad = associatedData(me.sign.pub, me.dh.pub, bundle.identitySign, bundle.identityDh);
  return { sk, ad, ephemeralPub: ek.pub, spkId: bundle.signedPreKey.id, opkId: bundle.oneTimePreKey?.id, bobRatchetKey: bundle.signedPreKey.pub };
}

/** Bob: answer Alice's first ("prekey") message. Delete the used one-time prekey afterwards. */
export function x3dhRespond(
  me: DeviceIdentity, spk: KeyPair, opk: KeyPair | undefined,
  alice: { identitySign: Uint8Array; identityDh: Uint8Array; identityDhSig: Uint8Array; ephemeral: Uint8Array },
) {
  if (!ed25519.verify(alice.identityDhSig, alice.identityDh, alice.identitySign)) throw new Error('Bad identity');
  const parts = [
    F,
    dh(spk.priv, alice.identityDh),
    dh(me.dh.priv, alice.ephemeral),
    dh(spk.priv, alice.ephemeral),
    ...(opk ? [dh(opk.priv, alice.ephemeral)] : []),
  ];
  const sk = hkdf(sha256, concatBytes(...parts), ZERO32, INFO, 32);
  parts.slice(1).forEach((p) => p.fill(0));
  return { sk, ad: associatedData(alice.identitySign, alice.identityDh, me.sign.pub, me.dh.pub) };
}
```

### 4.5 TypeScript: the Double Ratchet

Follows Signal's specification ("The Double Ratchet Algorithm", rev. 4), including skipped
message keys and transactional decryption: state only changes if decryption succeeds, so a forged
or corrupted packet can't break a session.

```ts
// crypto/v2/ratchet.ts
import { concatBytes, dh, eq, kdfCK, kdfRK, KeyPair, newX25519, open, seal, u32be } from './primitives';

const MAX_SKIP = 1000;                 // how far ahead a message may be (lost/out-of-order messages)
const MAX_STORED_SKIPPED = 2000;       // cap on remembered keys for messages not yet received
const SKIPPED_TTL_MS = 30 * 24 * 3600e3;

export interface Header { dh: Uint8Array; pn: number; n: number }
export const encodeHeader = (h: Header) => concatBytes(h.dh, u32be(h.pn), u32be(h.n)); // 40 bytes
export const decodeHeader = (b: Uint8Array): Header => {
  if (b.length !== 40) throw new Error('Bad header');
  const v = new DataView(b.buffer, b.byteOffset, 40);
  return { dh: b.slice(0, 32), pn: v.getUint32(32), n: v.getUint32(36) };
};

export interface RatchetState {
  ad: Uint8Array;
  dhs: KeyPair;
  dhr: Uint8Array | null;
  rk: Uint8Array;
  cks: Uint8Array | null;
  ckr: Uint8Array | null;
  ns: number; nr: number; pn: number;
  skipped: { dh: Uint8Array; n: number; mk: Uint8Array; at: number }[];
}

export function initAlice(sk: Uint8Array, ad: Uint8Array, bobRatchetKey: Uint8Array): RatchetState {
  const dhs = newX25519();
  const [rk, cks] = kdfRK(sk, dh(dhs.priv, bobRatchetKey));
  return { ad, dhs, dhr: bobRatchetKey, rk, cks, ckr: null, ns: 0, nr: 0, pn: 0, skipped: [] };
}

export function initBob(sk: Uint8Array, ad: Uint8Array, signedPreKey: KeyPair): RatchetState {
  return { ad, dhs: signedPreKey, dhr: null, rk: sk, cks: null, ckr: null, ns: 0, nr: 0, pn: 0, skipped: [] };
}

export function ratchetEncrypt(s: RatchetState, plaintext: Uint8Array): { header: Uint8Array; ciphertext: Uint8Array } {
  if (!s.cks) throw new Error('Session not ready to send');
  const [next, mk] = kdfCK(s.cks);
  s.cks = next;
  const header = encodeHeader({ dh: s.dhs.pub, pn: s.pn, n: s.ns });
  s.ns += 1;
  const ciphertext = seal(mk, plaintext, concatBytes(s.ad, header));
  mk.fill(0); // used once, gone
  return { header, ciphertext };
}

/** Decrypt on a copy; the caller stores the returned state only on success. */
export function ratchetDecrypt(state: RatchetState, headerBytes: Uint8Array, ciphertext: Uint8Array): { state: RatchetState; plaintext: Uint8Array } {
  const s = cloneState(state);
  const h = decodeHeader(headerBytes);
  const ad = concatBytes(s.ad, headerBytes);

  const i = s.skipped.findIndex((k) => k.n === h.n && eq(k.dh, h.dh));
  if (i >= 0) {
    const plaintext = open(s.skipped[i].mk, ciphertext, ad); // throws if forged
    s.skipped.splice(i, 1);
    return { state: s, plaintext };
  }
  if (!s.dhr || !eq(h.dh, s.dhr)) {
    skipKeys(s, h.pn);
    // DH ratchet step: new receiving chain from their new key, then a new sending chain from ours
    s.pn = s.ns; s.ns = 0; s.nr = 0; s.dhr = h.dh;
    [s.rk, s.ckr] = kdfRK(s.rk, dh(s.dhs.priv, s.dhr));
    s.dhs = newX25519();
    [s.rk, s.cks] = kdfRK(s.rk, dh(s.dhs.priv, s.dhr));
  }
  skipKeys(s, h.n);
  const [next, mk] = kdfCK(s.ckr!);
  s.ckr = next;
  s.nr += 1;
  const plaintext = open(mk, ciphertext, ad);
  mk.fill(0);
  return { state: s, plaintext };
}

function skipKeys(s: RatchetState, until: number) {
  if (!s.ckr) return;
  if (until - s.nr > MAX_SKIP) throw new Error('Too many skipped messages');
  while (s.nr < until) {
    const [next, mk] = kdfCK(s.ckr);
    s.ckr = next;
    s.skipped.push({ dh: s.dhr!, n: s.nr, mk, at: Date.now() });
    s.nr += 1;
  }
  const cutoff = Date.now() - SKIPPED_TTL_MS;
  s.skipped = s.skipped.filter((k) => k.at > cutoff).slice(-MAX_STORED_SKIPPED);
}

function cloneState(s: RatchetState): RatchetState {
  const c = (b: Uint8Array | null) => (b ? b.slice() : null);
  return {
    ...s, ad: s.ad.slice(), dhs: { priv: s.dhs.priv.slice(), pub: s.dhs.pub.slice() }, dhr: c(s.dhr), rk: s.rk.slice(),
    cks: c(s.cks), ckr: c(s.ckr), skipped: s.skipped.map((k) => ({ ...k, dh: k.dh.slice(), mk: k.mk.slice() })),
  };
}
```

**Rotation in this design:**
- **Every message:** the symmetric chain moves one step.
- **Every round trip** (the other side replies): a new X25519 ratchet key, which means new root
  material.
- **Signed prekey:** rotated every 7 days. The previous private key is kept 30 days so late first
  messages still work.
- **One-time prekeys:** used once. The device tops the server back up to 100 when it falls below 25.

### 4.6 Sending and receiving with several devices

A direct message from Alice to Bob is encrypted once per device:
- to **each of Bob's devices** in his signed device list;
- to **each of Alice's other devices**, as a "sent" copy, so her laptop shows what her phone sent
  (Signal's sync message).

Each (device, device) pair has its own ratchet session.

```ts
// crypto/v2/send.ts (sketch of the app-level flow)
async function sendDirect(conv: string, peerUser: string, body: PlainBody) {
  const plaintext = pad(encodeBody(body));              // §6.1, includes conv id + message id
  const targets = [
    ...(await verifiedDevices(peerUser)),               // Bob's signed list, checked against his pinned AIK
    ...(await verifiedDevices(myUserId)).filter((d) => d.id !== myDeviceId),
  ];
  const packets = [];
  for (const device of targets) {
    let session = await sessions.load(device);
    let pre: PreKeyInfo | undefined;
    if (!session) {                                      // first contact with this device: X3DH
      const bundle = await api.prekeyBundle(device.user, device.id);
      const x = x3dhInitiate(myIdentity, bundle);
      session = initAlice(x.sk, x.ad, x.bobRatchetKey);
      pre = { ik: myIdentity.sign.pub, ikdh: myIdentity.dh.pub, ikdhSig: myIdentity.dhSig, ek: x.ephemeralPub, spk: x.spkId, opk: x.opkId };
    }
    const { header, ciphertext } = ratchetEncrypt(session, plaintext);
    await sessions.save(device, session, pre);          // keep sending pre-info until Bob replies
    packets.push(messagePacket(conv, device, header, ciphertext, pre));
  }
  socket.send({ type: 'message', roomId: conv, packets });   // server queues one packet per device
}

async function receiveDirect(p: MessagePacket) {
  let state = await sessions.load(p.from);
  if (p.kind === 'pkmsg') {
    if (!(await deviceIsInSignedList(p.from, p.pre!.ik, p.pre!.ikdh))) throw new Error('Unknown device');
    const spk = await prekeys.signed(p.pre!.spk);
    const opk = p.pre!.opk !== undefined ? await prekeys.takeOneTime(p.pre!.opk) : undefined; // deleted on success
    const x = x3dhRespond(myIdentity, spk, opk, { identitySign: p.pre!.ik, identityDh: p.pre!.ikdh, identityDhSig: p.pre!.ikdhSig, ephemeral: p.pre!.ek });
    state = initBob(x.sk, x.ad, spk);
  }
  const { state: next, plaintext } = ratchetDecrypt(state!, p.header, p.ciphertext);
  const body = decodeBody(unpad(plaintext));
  if (body.conv !== p.conv || seenIds.has(body.id)) throw new Error('Replayed or misrouted'); // W5
  await db.transaction(async () => {                    // plaintext + new state saved together
    await sessions.store(p.from, next);
    await messages.insert(body);
  });
  await api.ack(p.id);                                  // the server deletes the packet for this device
}
```

**Architectural consequence.** Because each message can be decrypted only once, every device
keeps its own **local, encrypted message database**:
- SQLite with an at-rest key in Keychain/Keystore on phones;
- IndexedDB on the web, with a non-extractable WebCrypto key.

The server becomes a **mailbox**: it queues one packet per target device and deletes it once
acknowledged. Today the apps re-download and decrypt history from the server; in v2 they read it
locally, and new devices get it through history transfer (§3.5). This is the biggest change for the
existing system, and it's the change that removes W1.

---

## 5. Groups: Sender Keys

Pairwise encryption to every device of every member costs O(members × devices) per message.
Signal and WhatsApp groups use **Sender Keys** instead:

- Each sending device has, per group, a **chain key** and an **Ed25519 signing key pair**.
- It sends `{chainKey, iteration, signingPub}` once to every member device, through the pairwise
  ratchet sessions. This is a SenderKeyDistributionMessage (SKDM), which is itself end-to-end
  encrypted.
- Each group message is then encrypted **once** with the next message key from that chain, and
  signed with the sender-key signing key, so members can't forge each other's messages.
- **Rotation:**
  - on every membership change, every remaining member creates a new sender key and distributes
    it;
  - every 7 days or 1,000 messages;
  - immediately when a device is removed from a member's device list.
- **New members** get the current sender keys from then on and can't read earlier messages (as in
  WhatsApp). **Removed members** don't get the new keys.

Trade-off: sender keys have forward secrecy (the chain is one-way) but only heal after rotation,
not on every round trip. That's why direct chats use the full Double Ratchet. For large groups,
MLS (RFC 9420) is the modern alternative. It's not needed at Papyris's group sizes.

```ts
// crypto/v2/senderKeys.ts
import { concatBytes, ed25519, kdfCK, newEd25519, open, randomBytes, seal, u32be, utf8ToBytes } from './primitives';

const MAX_FORWARD = 2000;

export interface SenderKeyState { keyId: number; iteration: number; chainKey: Uint8Array; signPub: Uint8Array; signPriv?: Uint8Array; skipped: Map<number, Uint8Array> }

export function newSenderKey(): SenderKeyState {
  const sign = newEd25519();
  return { keyId: new DataView(randomBytes(4).buffer).getUint32(0), iteration: 0, chainKey: randomBytes(32), signPub: sign.pub, signPriv: sign.priv, skipped: new Map() };
}

/** What goes to each member device through its pairwise session (type 'skdm'). Never the signing private key. */
export const distribution = (s: SenderKeyState) => ({ keyId: s.keyId, iteration: s.iteration, chainKey: s.chainKey.slice(), signPub: s.signPub });

const groupAd = (conv: string, sender: string, keyId: number, it: number) =>
  concatBytes(utf8ToBytes(`PapyrisGroup.v2|${conv}|${sender}|`), u32be(keyId), u32be(it));

export function groupEncrypt(s: SenderKeyState, conv: string, sender: string, plaintext: Uint8Array) {
  const [next, mk] = kdfCK(s.chainKey);
  const it = s.iteration;
  s.chainKey = next; s.iteration += 1;
  const ad = groupAd(conv, sender, s.keyId, it);
  const ciphertext = seal(mk, plaintext, ad);
  mk.fill(0);
  const signature = ed25519.sign(concatBytes(ad, ciphertext), s.signPriv!);
  return { keyId: s.keyId, iteration: it, ciphertext, signature };
}

export function groupDecrypt(s: SenderKeyState, conv: string, sender: string, p: { iteration: number; ciphertext: Uint8Array; signature: Uint8Array }) {
  const ad = groupAd(conv, sender, s.keyId, p.iteration);
  if (!ed25519.verify(p.signature, concatBytes(ad, p.ciphertext), s.signPub)) throw new Error('Bad signature');
  let mk = s.skipped.get(p.iteration);
  if (mk) {
    s.skipped.delete(p.iteration);
  } else {
    if (p.iteration < s.iteration) throw new Error('Old or replayed message');
    if (p.iteration - s.iteration > MAX_FORWARD) throw new Error('Too far ahead');
    while (s.iteration < p.iteration) { const [n, k] = kdfCK(s.chainKey); s.skipped.set(s.iteration, k); s.chainKey = n; s.iteration += 1; }
    const [n, k] = kdfCK(s.chainKey);
    s.chainKey = n; s.iteration += 1; mk = k;
  }
  const plaintext = open(mk, p.ciphertext, ad);
  mk.fill(0);
  return plaintext;
}
```

(As with the ratchet, run `groupDecrypt` on a copy and keep the copy only on success.)

---

## 6. Message contents

### 6.1 Plaintext body (inside every ratchet/sender-key ciphertext)

```json
{
  "v": 2,
  "id": "4f0c…uuid",            // sender-chosen, unique: receivers drop duplicates (replay)
  "conv": "conversation uuid",   // must equal the packet's conversation (no re-routing)
  "ts": 1760000000000,
  "kind": "text | media | edit | delete | reaction | skdm | sync | keys_changed_notice",
  "text": "…",
  "media": [ MediaPointer ],     // §7
  "replyTo": "message id",
  "edit": { "of": "message id", "rev": 3 },   // receivers ignore rev <= the one they have (rollback)
  "skdm": { "keyId": 123, "iteration": 0, "chainKey": "b64", "signPub": "b64" },
  "sync": { "sentTo": "conversation uuid", "body": { … } }   // copy for my other devices
}
```

Encoding: UTF-8 JSON (or protobuf). Then pad, as Signal does: append `0x80`, then zero bytes up
to the next multiple of 160 bytes. Unpad by stripping trailing zeros and the `0x80`. This hides
exact text length (W6).

```ts
export const pad = (b: Uint8Array) => { const n = Math.ceil((b.length + 1) / 160) * 160; const out = new Uint8Array(n); out.set(b); out[b.length] = 0x80; return out; };
export const unpad = (b: Uint8Array) => { let i = b.length - 1; while (i >= 0 && b[i] === 0) i--; if (i < 0 || b[i] !== 0x80) throw new Error('Bad padding'); return b.slice(0, i); };
```

### 6.2 Message packet (direct chats, one per target device)

Sent over the WebSocket. Base64 for byte fields.

```json
{
  "v": 2,
  "kind": "pkmsg",                          // "pkmsg" = first messages of a session, "msg" afterwards
  "conv": "conversation uuid",
  "from": { "user": "uuid", "device": 3 },
  "to":   { "user": "uuid", "device": 1 },
  "pre": {                                  // only for "pkmsg"
    "ik":     "b64 32  sender DIK Ed25519",
    "ikdh":   "b64 32  sender DIK X25519",
    "ikdhSig":"b64 64",
    "ek":     "b64 32  X3DH ephemeral",
    "spk": 17,                              // which signed prekey
    "opk": 4021                             // which one-time prekey (absent if none was left)
  },
  "h": "b64 40   dh(32) || pn(u32be) || n(u32be)",
  "c": "b64      ChaCha20-Poly1305(key, nonce from MSG_KEYS(mk), AD = X3DH AD || h) of padded body"
}
```

### 6.3 Group packet (sender keys, one per message)

```json
{
  "v": 2,
  "kind": "skmsg",
  "conv": "conversation uuid",
  "from": { "user": "uuid", "device": 3 },
  "kid": 2938471,                     // sender key id
  "it": 57,                           // chain iteration
  "c": "b64  ChaCha20-Poly1305 of padded body, AD = 'PapyrisGroup.v2|conv|user:device|' || kid || it",
  "sig": "b64 64  Ed25519(sender-key signing key, AD || c)"
}
```

The server stores group packets once (as today's `messages.text`). Direct-chat packets go to
per-device mailboxes.

---

## 7. Photos, videos, voice notes and files

The same format serves every kind of attachment, including the history bundle. The *message*
carries the key; the *server* stores only the encrypted blob.

### 7.1 Per-type handling before encryption

| Type | Before encrypting (on the device) | Pointer extras |
|---|---|---|
| **Image** | Re-encode (removes EXIF/GPS), max 1600 px (4096 HD). Make a ~64 px blurred preview. | `w`, `h`, `blur` (tiny JPEG, inline base64, ~1 KB) |
| **Video** | Optional compression (native). Grab a poster frame and encrypt it as its **own** blob with its own key. | `w`, `h`, `dur`, `thumb` pointer |
| **Voice note** | Opus/AAC as recorded | `dur`, waveform (inline, 64 bytes) |
| **File** | As is. JPEGs sent as documents lose APP1/APP13/COM segments. | `name`, `mime` |

Thumbnails, blurred previews and waveforms are inside the encrypted pointer, never on the server
in the clear.

### 7.2 Blob format ("PMV2"), chunked AEAD

```text
offset  size  field
0       4     magic "PMV2"
4       1     version = 2
5       1     flags: bit0 = padded
6       4     chunk size, u32be (65536)
10      6     reserved, zero
16      …     chunk_0 || chunk_1 || … || chunk_last
              each chunk_i = ChaCha20-Poly1305(K, nonce_i, AAD = header[0..16]) of plaintext_i (≤ chunk size) + 16-byte tag

K        = HKDF(salt = 0x00*32, ikm = fileKey, info = "PapyrisMedia.v2", 32)
nonce_i  = u64be(i) || 0x000000 || last_i        (12 bytes; last_i = 1 for the final chunk, else 0)
padding  = plaintext padded with zeros to the Padmé size of its length; the real size is in the pointer
```

Why this layout:
- **Numbered chunks plus a final flag** is the STREAM construction (Hoang et al.). Chunks can't be
  reordered, duplicated or cut off, and an empty or truncated file fails.
- **The header is authenticated in every chunk,** so the chunk size can't be swapped.
- **Random access:** chunk *i* decrypts on its own. Videos can seek and stream through a local
  proxy (a Service Worker on web, a local HTTP handler on mobile) without decrypting the whole file.
- **Nonces are derived, not random:** one key per file, counters unique per chunk.
- **Padmé padding** hides exact sizes, costing at most about 12% extra.

### 7.3 Media pointer (inside the encrypted message body)

```json
{
  "url": "/api/v1/media/2026/10/<hex>.enc",
  "key": "b64 32   random file key, never reused",
  "sha256": "b64 32  hash of the whole encrypted blob (checked before decrypting; also a cache key)",
  "size": 1834221,                 // real plaintext size (before padding)
  "mime": "video/mp4",
  "name": "holiday.mp4",
  "w": 1280, "h": 720, "dur": 14.2,
  "blur": "b64 small preview",     // images
  "thumb": { "url": "…", "key": "b64 32", "sha256": "b64 32", "size": 18311, "mime": "image/jpeg" }
}
```

```ts
// crypto/v2/media.ts (whole-buffer version; streaming uses the same per-chunk calls)
import { chacha20poly1305 } from '@noble/ciphers/chacha';
import { concatBytes, hkdf, randomBytes, sha256, u64be, utf8ToBytes, ZERO32 } from './primitives';

const CHUNK = 64 * 1024;
const header = (padded: boolean) => { const h = new Uint8Array(16); h.set(utf8ToBytes('PMV2')); h[4] = 2; h[5] = padded ? 1 : 0; new DataView(h.buffer).setUint32(6, CHUNK); return h; };
const fileKeyToK = (fk: Uint8Array) => hkdf(sha256, fk, ZERO32, utf8ToBytes('PapyrisMedia.v2'), 32);
const nonce = (i: number, last: boolean) => { const n = new Uint8Array(12); n.set(u64be(i)); n[11] = last ? 1 : 0; return n; };

/** Padmé: pad to a size with few significant bits (leaks O(log log n) bits of the length). */
export function padme(len: number): number {
  if (len < 2) return len;
  const e = Math.floor(Math.log2(len));
  const s = Math.floor(Math.log2(e)) + 1;
  const mask = 2 ** (e - s) - 1;
  return Math.ceil((len + mask) / (mask + 1)) * (mask + 1);
}

export function encryptMedia(plain: Uint8Array) {
  const fileKey = randomBytes(32);
  const K = fileKeyToK(fileKey);
  const padded = new Uint8Array(padme(plain.length)); padded.set(plain);
  const h = header(true);
  const parts = [h];
  const count = Math.max(1, Math.ceil(padded.length / CHUNK));
  for (let i = 0; i < count; i++) {
    const last = i === count - 1;
    parts.push(chacha20poly1305(K, nonce(i, last), h).encrypt(padded.subarray(i * CHUNK, (i + 1) * CHUNK)));
  }
  const blob = concatBytes(...parts);
  return { blob, pointer: { key: fileKey, sha256: sha256(blob), size: plain.length } };
}

export function decryptMedia(blob: Uint8Array, p: { key: Uint8Array; sha256: Uint8Array; size: number }) {
  const digest = sha256(blob);
  if (!digest.every((b: number, i: number) => b === p.sha256[i])) throw new Error('File was changed');
  const h = blob.subarray(0, 16);
  if (new TextDecoder().decode(h.subarray(0, 4)) !== 'PMV2' || h[4] !== 2) throw new Error('Unknown format');
  const chunk = new DataView(h.buffer, h.byteOffset).getUint32(6);
  const K = fileKeyToK(p.key);
  const body = blob.subarray(16);
  const step = chunk + 16;
  const count = Math.ceil(body.length / step);
  const out: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    out.push(chacha20poly1305(K, nonce(i, i === count - 1), h).decrypt(body.subarray(i * step, (i + 1) * step)));
  }
  return concatBytes(...out).subarray(0, p.size);
}
```

Encrypting a video or file is the same call, streamed chunk by chunk (as `mobile/src/crypto/media.ts`
already does for v1). The sender keeps no copy of the file key outside its local message database.

---

## 8. Device-link packets

```text
QR text (shown by the new device):
papyris-link:2:<requestId>:<b64url ek_N 32>:<b64url DIK_sign_N 32>:<b64url DIK_dh_N 32>

Typed fallback code (16 chars, base32): first 80 bits of SHA-256(ek_N || DIK_sign_N || DIK_dh_N)
```

**Link request** (new device → server, `POST /devices/link-requests`):

```json
{ "ek": "b64 32", "dikSign": "b64 32", "dikDh": "b64 32", "dikDhSig": "b64 64", "name": "Chrome on Mac" }
```

**Link grant** (primary → server → new device, fetched once, then deleted):

```json
{
  "v": 2,
  "requestId": "uuid",
  "e": "b64 32   primary's one-off X25519 key",
  "c": "b64      ChaCha20-Poly1305(K, nonce = 0x00*12, AAD = 'PapyrisLink.v2|' || requestId || ek_N || e) of the payload"
}
K = HKDF(salt = SHA-256(requestId), ikm = X25519(e_priv, ek_N), info = "PapyrisLink.v2", 32)
```

A zero nonce is safe here because `K` comes from two one-off keys and encrypts exactly one
message.

**Grant payload** (decrypted by the new device only):

```json
{
  "account": { "user": "uuid", "aik": "b64 32" },
  "device":  { "id": 4, "cert": "b64 64", "created": 1760000000000 },
  "deviceList": { "user": "uuid", "version": 9, "devices": [ … ], "sig": "b64 64" },
  "pins": [ { "user": "uuid", "aik": "b64 32", "verified": true } ],          // contacts' pinned keys
  "history": { "url": "…", "key": "b64 32", "sha256": "b64 32", "size": 8123456, "from": 1750000000000 }
}
```

**Signed device list** (published by the primary to the server; fetched by anyone who messages the user):

```json
{ "user": "uuid", "version": 9,
  "devices": [ { "id": 1, "sign": "b64", "dh": "b64", "created": 1759000000000, "cert": "b64 64" } ],
  "sig": "b64 64   Ed25519(AIK, 'PapyrisDeviceList.v2' || canonical JSON without sig)" }
```

```ts
// crypto/v2/link.ts
import { chacha20poly1305 } from '@noble/ciphers/chacha';
import { concatBytes, dh, ed25519, hkdf, newX25519, sha256, u32be, u64be, utf8ToBytes } from './primitives';

const linkKey = (shared: Uint8Array, requestId: string) => hkdf(sha256, shared, sha256(utf8ToBytes(requestId)), utf8ToBytes('PapyrisLink.v2'), 32);
const linkAad = (requestId: string, ekN: Uint8Array, eP: Uint8Array) => concatBytes(utf8ToBytes(`PapyrisLink.v2|${requestId}`), ekN, eP);

/** Primary: certify the scanned device and send it the grant. `payload` is the JSON above (UTF-8). */
export function sealGrant(requestId: string, ekN: Uint8Array, payload: Uint8Array) {
  const e = newX25519();
  const c = chacha20poly1305(linkKey(dh(e.priv, ekN), requestId), new Uint8Array(12), linkAad(requestId, ekN, e.pub)).encrypt(payload);
  e.priv.fill(0);
  return { v: 2, requestId, e: e.pub, c };
}

export function openGrant(grant: { requestId: string; e: Uint8Array; c: Uint8Array }, ekN: { priv: Uint8Array; pub: Uint8Array }) {
  return chacha20poly1305(linkKey(dh(ekN.priv, grant.e), grant.requestId), new Uint8Array(12), linkAad(grant.requestId, ekN.pub, grant.e)).decrypt(grant.c);
}

export function deviceCert(aikPriv: Uint8Array, user: string, deviceId: number, sign: Uint8Array, dhPub: Uint8Array, created: number) {
  const u = utf8ToBytes(user);
  const msg = concatBytes(utf8ToBytes('PapyrisDeviceCert.v2'), u32be(u.length).subarray(2), u, u32be(deviceId), sign, dhPub, u64be(created));
  return ed25519.sign(msg, aikPriv);
}
```

---

## 9. Device synchronisation

| Event | What happens |
|---|---|
| I send from my phone | My other devices get a `sync` body through their own pairwise sessions, containing the conversation and the message. |
| I read a chat on my laptop | A `sync` body `{kind: "read", conv, upTo}` goes to my other devices, so unread counts match. |
| A new device is linked | The primary publishes device list v+1. Contacts' apps see the new version (WebSocket notice plus a version check before sending) and start X3DH sessions with the new device on the next message. Groups: every member sends the new device an SKDM for their current sender key. |
| A device is removed or logs out | The primary publishes device list v+1 without it. Every contact stops encrypting to it. Group members rotate their sender keys (§5). |
| Start fresh (lost every device) | New AIK. Contacts see "security code changed"; verified contacts must accept it first. |
| Primary lost but a browser is still linked | The browser can't certify new devices (it has no AIK). It can "promote itself" by starting fresh with a new AIK, keeping its local history. Contacts get one security-code-changed notice. |

---

## 10. Migration from version 1

1. **Server:**
   - add device registry, prekey storage, per-device mailboxes and signed device lists;
   - keep the v1 endpoints read-only so v1 messages stay readable;
   - group packets keep using `messages`.
2. **Clients:** add a local encrypted message database first (it's needed by everything else), then
   v2 packets. v1 envelopes keep decrypting with the v1 account key, which each device keeps
   only for reading old messages.
3. **Rollout:** a client that has every target device's v2 keys sends v2; otherwise it sends v1,
   as it does now for "not encrypted yet" chats. After all clients are on v2, stop sending v1.
4. **Tests:**
   - the Signal Double Ratchet and X3DH test vectors (run against our KDF labels by also running
     the reference labels);
   - out-of-order, lost and replayed messages;
   - forged headers;
   - device add/remove;
   - sender-key rotation on member removal;
   - cross-checks between the web and phone implementations (shared files, as today).
5. **Audit:** have an independent cryptographer review the implementation before switching the
   default. Signal's own library, libsignal, is AGPL-licensed and has no supported browser or
   React Native build, so a careful in-house implementation of the published specs is the
   realistic path. This document follows those specs: X3DH, Double Ratchet rev. 4 and Sender Keys.

---

## 11. Summary of decisions

- **One key per message**, from ratcheting chains; never a long-lived key per chat or account.
- **Direct chats:** X3DH + Double Ratchet per device pair, for forward secrecy and post-compromise
  security.
- **Groups:** Sender Keys distributed over pairwise sessions, rotated on membership change.
- **Devices:** each has its own identity, certified by an account key that stays on the primary.
  Contacts pin the account key.
- **Linking:** QR carries the new device's keys; grant under ephemeral-ephemeral X25519; history
  moved as an encrypted blob whose key travels only device to device.
- **Media:** a fresh random key per file; chunked ChaCha20-Poly1305 (STREAM) with authenticated
  header and final-chunk flag; Padmé padding; key, hash and metadata only inside encrypted
  messages.
- **ChaCha20-Poly1305 throughout:** constant-time and fast in pure JavaScript. The same format
  accepts AES-256-GCM if file encryption later moves to native code.
- **Server:** stores ciphertext, public keys and signed lists only. Mailboxes delete packets after
  delivery; devices keep encrypted local history.

---

## 12. Implementation status (branch `feature/e2e-v2`)

| Phase | What | Status |
|---|---|---|
| 1 | Protocol library `src/crypto/v2/`, shared word for word by web and mobile (`npm run check:e2e`): identities, device certificates and signed device lists, safety numbers, prekeys, X3DH, Double Ratchet, sessions with transactional commit, Sender Keys, padded message bodies, PMV2 media (streaming and random access), link offers and grants, packet formats. 31 tests per app. | Done |
| 2 | Server: device registry, signed/one-time prekeys and bundles, signed device lists (checked with the same bytes as the apps; cross-language fixture), v2 linking, per-device mailboxes (`/api/v1/e2e/v2/...`, migration 0009). | Done |
| 3 | Encrypted local storage on each device (`v2/storage.ts`, transactions with per-transaction views): identity, prekeys, sessions, sender keys, pinned account keys, device lists and the local message database. Web: IndexedDB with every value AES-GCM-encrypted under a non-extractable key (`v2-platform/idbKV.ts`). Phone: SQLite encrypted with SQLCipher, key in Keychain/Keystore (`v2-platform/sqliteKV.ts`). Device upkeep (`v2/device.ts`): registration, first device becomes primary and publishes the signed list, one-time prekeys refilled below 25, signed prekey rotated weekly and kept 30 days. Starts in the background after sign-in; logout removes the device and wipes local data. | Done |
| 4 | Sending and receiving (`v2/messenger.ts`, shared): device directory with pinned account keys; Double Ratchet per device pair for direct chats, copies to the account's other devices; Sender Keys for groups, handed out once per device and replaced when a member or device leaves or after 7 days/1,000 messages; edits as follow-up packets; mailbox draining with packets that can't be read yet kept for later. Server: WebSocket `message_v2` (timeline row holds only the `e2e2:` marker; packets go to per-device mailboxes and are deleted on acknowledgement). Web and phone: history and chat-list previews filled from the encrypted local database; photos, videos, voice notes and files in PMV2 (streamed on the phone); forwards reuse the file key. A chat uses v2 once every member has a v2 device list, otherwise v1 as before. Browser test `e2e/v2_messaging_e2e.py`. Also: optional encrypted backup with a 64-digit recovery key and a warning before logging out of the last device. | Done |
| 5 | Linking v2 and history transfer (`v2/accountLink.ts`, shared; `v2-platform/link.ts` per app). The new device shows a QR code and a 16-character code; any linked device scans or types it, checks the keys against the server's copy, publishes device list v+1 and sends a grant encrypted for the new device only, with the account key, the people's pinned keys, the version 1 keys and (optional) the message history as one PMV2 file (deleted from the server once downloaded). "Start fresh" makes a new account key; restoring a backup re-adds the device with the saved account key (same security code). Logging out takes the device off the list. If every listed device has logged out, a device that still has the keys takes over automatically. Messages sent before a device joined (server clock) show as unreadable rather than waiting forever. Server: migration 0011 (`e2e_devices.history_url`), `DELETE /e2e/v2/devices/{id}/history`, server time in the list-publish reply. | Done |
| 5 (open) | Approving from the phone was not tried by hand (the test phone blocks automated taps). | |
| 6 | Trust (`v2/trust.ts`, shared; `v2-platform/trust.ts` per app): the security code is the 60-digit safety number of both account keys, so it doesn't change when either person links a device. "Mark as verified" after comparing, or scan the QR code under the code with the phone app (both people and both keys must match). When someone's account key changes the chat shows "X's security code changed" until dismissed; if they were verified, sending to them is refused (`identity_changed`) until the new code is verified again or accepted. Browser test `e2e/trust_e2e.py`. Verification is kept per device (not yet synced between your own devices). | Done |
| 7 | Migration from v1 (read old envelopes, switch sending once everyone has v2), browser and device tests, external review. | |
