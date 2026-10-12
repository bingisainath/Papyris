// Linking another device to this account's encryption keys, like WhatsApp Web.
// Shared word for word by web/src/crypto/linking.ts and mobile/src/crypto/linking.ts.
//
// New device:      startLink() -> show the QR (or code) -> waitForKeys()
// Signed-in device: approveFromQr(scanned text) or findByCode(typed code) -> confirm -> approve()

import {
  linkCode, linkQrText, newLinkKey, normalizeLinkCode, openKeysFromDevice, parseLinkQr, publicKeysOf, sealKeysForDevice, fromBase64, toBase64,
} from './e2e';
import type { KeyPairs } from './e2e';
import { e2eSession } from './session';
import { e2eService } from '../services/e2e.service';
import type { LinkRequest } from '../services/e2e.service';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(() => resolve(), ms));

export interface PendingLink {
  request: LinkRequest;
  qrText: string;
  code: string;
  privateKey: Uint8Array;
}

/** New device: ask for the keys. Show `qrText` as a QR code and `code` under it. */
export async function startLink(deviceName: string): Promise<PendingLink> {
  const { privateKey, publicKey } = newLinkKey();
  const request = await e2eService.createLinkRequest(toBase64(publicKey), deviceName);
  return { request, qrText: linkQrText(request.id, publicKey), code: request.code, privateKey };
}

/**
 * New device: wait until a signed-in device has sent the keys, and open them. Resolves with the
 * keys, or null if `cancelled()` became true or the request expired.
 */
export async function waitForKeys(link: PendingLink, expectedEncPublic: string, cancelled: () => boolean, intervalMs = 2000): Promise<KeyPairs | null> {
  while (!cancelled()) {
    let status: LinkRequest;
    try {
      status = await e2eService.linkRequest(link.request.id);
    } catch (e: any) {
      if (e?.response?.status === 404) return null; // expired
      await sleep(intervalMs); // offline for a moment
      continue;
    }
    if (status.status === 'approved' && status.payload) {
      const keys = openKeysFromDevice(status.payload, link.privateKey, link.request.id);
      if (publicKeysOf(keys).enc !== expectedEncPublic) throw new Error("The keys from the other device don't match this account");
      return keys;
    }
    await sleep(intervalMs);
  }
  return null;
}

/** A request found by scanning or typing, checked to really be from the device showing the code. */
export interface FoundLink {
  request: LinkRequest;
  devicePublic: Uint8Array;
}

/** Signed-in device: the scanned QR's own key must match what the server has for that request. */
export async function findByQr(qrText: string): Promise<FoundLink> {
  const parsed = parseLinkQr(qrText);
  if (!parsed) throw new Error("That isn't a Papyris link code");
  const request = await e2eService.linkRequest(parsed.requestId);
  if (request.ephemeral_public !== toBase64(parsed.publicKey)) throw new Error("This code doesn't match. Start again on the new device.");
  return { request, devicePublic: parsed.publicKey };
}

/** Signed-in device: the typed code must be the fingerprint of the key the server hands back. */
export async function findByCode(typed: string): Promise<FoundLink> {
  const code = normalizeLinkCode(typed);
  if (code.length !== 16) throw new Error('The code has 16 letters and numbers');
  const request = await e2eService.findLinkRequest(code);
  const devicePublic = fromBase64(request.ephemeral_public);
  if (linkCode(devicePublic) !== code) throw new Error("This code doesn't match. Start again on the new device.");
  return { request, devicePublic };
}

/** Signed-in device: send this account's keys, encrypted so only that device can open them. */
export async function approve(found: FoundLink): Promise<void> {
  const keys = e2eSession.keys();
  if (!keys) throw new Error("This device doesn't have the keys");
  await e2eService.approveLink(found.request.id, sealKeysForDevice(keys, found.devicePublic, found.request.id));
}
