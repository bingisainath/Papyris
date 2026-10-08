// X3DH session setup (docs/encryption-design-v2.md §4.1), following Signal's specification.

import { concatBytes, dh, hkdf, KeyPair, newX25519, sha256, unb64, utf8, ZERO32 } from './primitives';
import type { DeviceIdentity } from './identity';
import { PreKeyBundle, verifyBundle } from './prekeys';

const F = new Uint8Array(32).fill(0xff); // Signal's domain separator for X25519
const INFO = utf8('PapyrisX3DH.v2');

/** Binds both devices' identities into every message of the session. */
export const associatedData = (aSign: Uint8Array, aDh: Uint8Array, bSign: Uint8Array, bDh: Uint8Array): Uint8Array =>
  concatBytes(utf8('PapyrisAD.v2'), aSign, aDh, bSign, bDh);

function deriveSecret(dhs: Uint8Array[]): Uint8Array {
  const sk = hkdf(sha256, concatBytes(F, ...dhs), ZERO32, INFO, 32);
  dhs.forEach((d) => d.fill(0)); // the DH outputs aren't needed again
  return sk;
}

export interface X3DHStart {
  sk: Uint8Array;
  ad: Uint8Array;
  ephemeralPub: Uint8Array;
  signedPreKeyId: number;
  oneTimePreKeyId?: number;
  theirRatchetKey: Uint8Array; // the signed prekey doubles as Bob's first ratchet key
}

/**
 * Start a session with one of someone's devices. The bundle's identity must already have been
 * checked against their signed device list (the caller does that).
 */
export function x3dhInitiate(me: DeviceIdentity, bundle: PreKeyBundle): X3DHStart {
  verifyBundle(bundle);
  const theirDh = unb64(bundle.identityDh);
  const spk = unb64(bundle.signedPreKey.pub);
  const ek = newX25519();
  const dhs = [dh(me.dh.priv, spk), dh(ek.priv, theirDh), dh(ek.priv, spk)];
  if (bundle.oneTimePreKey) dhs.push(dh(ek.priv, unb64(bundle.oneTimePreKey.pub)));
  const sk = deriveSecret(dhs);
  ek.priv.fill(0);
  return {
    sk,
    ad: associatedData(me.sign.pub, me.dh.pub, unb64(bundle.identitySign), theirDh),
    ephemeralPub: ek.pub,
    signedPreKeyId: bundle.signedPreKey.id,
    oneTimePreKeyId: bundle.oneTimePreKey?.id,
    theirRatchetKey: spk,
  };
}

/** Answer a first ("prekey") message. The caller deletes the used one-time prekey on success. */
export function x3dhRespond(
  me: DeviceIdentity,
  signedPreKey: KeyPair,
  oneTimePreKey: KeyPair | undefined,
  them: { identitySign: Uint8Array; identityDh: Uint8Array; ephemeral: Uint8Array },
): { sk: Uint8Array; ad: Uint8Array } {
  const dhs = [dh(signedPreKey.priv, them.identityDh), dh(me.dh.priv, them.ephemeral), dh(signedPreKey.priv, them.ephemeral)];
  if (oneTimePreKey) dhs.push(dh(oneTimePreKey.priv, them.ephemeral));
  return { sk: deriveSecret(dhs), ad: associatedData(them.identitySign, them.identityDh, me.sign.pub, me.dh.pub) };
}
