// Linking devices and changing the account's device list (docs/encryption-design-v2.md §3.3, §3.5, §9; phase 5).
//
// New device:    startDeviceLink() -> show the QR text (or code) -> waitForGrant() -> it's on the list,
//                with the account key, the people it should trust and (optionally) the message history.
// Linked device: findLinkByQr()/findLinkByCode() -> confirm with the person -> approveDeviceLink().
// No other device: startFreshAccount() (new account key) or adoptAccountKey() (from a backup).
//
// The server only ever sees public keys, signed lists, and blobs encrypted for one device.

import { b64, CryptoError, ed25519, eq, fromUtf8, KeyPair, newX25519, unb64, utf8 } from './primitives';
import type { DeviceList, DevicePublic } from './identity';
import { certifyDevice, loadDeviceIdentity, newAccountIdentity, signDeviceList, verifyDeviceList } from './identity';
import { linkCodeV2, linkQrText, openGrant, parseLinkQr, sealGrant } from './link';
import type { GrantPayload, LinkGrant, LinkOffer } from './link';
import type { E2EHttp } from './device';
import { httpStatus } from './device';
import type { EncryptedStore, LocalMessage, Pin } from './storage';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A link request as the server shows it (keys are the new device's public keys). */
export interface LinkRequestView {
  id: string;
  device_id: number;
  name: string;
  ek: string;
  sign: string;
  dh: string;
  dhSig: string;
  code: string;
  expires_at: string;
  status?: 'waiting' | 'approved';
  grant?: LinkGrant;
}

// ---------------------------------------------------------------- the account's device list

async function currentList(http: E2EHttp, user: string): Promise<DeviceList | null> {
  try {
    return await http.get<DeviceList>(`/e2e/v2/users/${user}/device-list`);
  } catch (e) {
    if (httpStatus(e) === 404) return null;
    throw e;
  }
}

/**
 * Sign and publish a new version of the account's device list: the devices already on it that are
 * still signed in, plus `add`, minus `remove`. A list signed by another account key (or `fresh`)
 * is replaced by one with just the added devices.
 */
export async function publishDeviceList(
  store: EncryptedStore, http: E2EHttp, user: string, aik: KeyPair,
  change: { add?: { id: number; sign: Uint8Array; dh: Uint8Array; dhSig: Uint8Array }[]; remove?: number[]; fresh?: boolean },
): Promise<DeviceList & { publishedAt: number }> {
  for (let attempt = 0; ; attempt++) {
    const [current, mine] = await Promise.all([
      currentList(http, user),
      http.get<{ devices: { device_id: number; sign: string; dh: string }[] }>('/e2e/v2/devices/me'),
    ]);
    const active = new Map(mine.devices.map((d) => [d.device_id, d]));
    const sameKey = !!current && current.aik === b64(aik.pub) && !change.fresh;
    let devices: DevicePublic[] = sameKey
      ? verifyDeviceList(current!, user, aik.pub).filter((d) => active.get(d.id)?.sign === d.sign && active.get(d.id)?.dh === d.dh)
      : [];
    for (const d of change.add || []) {
      devices = devices.filter((x) => x.id !== d.id);
      devices.push(certifyDevice(aik.priv, user, d.id, d));
    }
    devices = devices.filter((d) => !(change.remove || []).includes(d.id)).sort((a, b) => a.id - b.id);
    const list = signDeviceList(aik, user, sameKey ? current!.version + 1 : (current?.version || 0) + 1, devices);
    try {
      const published = await http.put<{ server_time?: string } | undefined>('/e2e/v2/device-list', { device_list: list, replace: !!current && !sameKey });
      await store.saveDeviceList(user, list);
      return { ...list, publishedAt: serverTime(published) };
    } catch (e) {
      if (httpStatus(e) === 409 && attempt < 2) continue; // another device published at the same moment
      throw e;
    }
  }
}

/** Server time from a device-list publish (message times use the server's clock too). */
export const serverTime = (r?: { server_time?: string } | null): number => (r?.server_time && Date.parse(r.server_time)) || Date.now();

async function selfKeys(store: EncryptedStore) {
  const device = await store.device();
  if (!device?.deviceId) throw new CryptoError('no_session', "This device isn't registered yet");
  const identity = loadDeviceIdentity(device.identity);
  return { device, identity, add: { id: device.deviceId, sign: identity.sign.pub, dh: identity.dh.pub, dhSig: identity.dhSig } };
}

async function pinSelf(store: EncryptedStore, user: string, aik: KeyPair) {
  await store.savePin(user, { aik: b64(aik.pub), verified: true, firstSeen: Date.now() });
}

/** Lost every other device: a new account key and a list with just this device. Contacts see a new security code. */
export async function startFreshAccount(store: EncryptedStore, http: E2EHttp, user: string): Promise<void> {
  const { device, add } = await selfKeys(store);
  const aik = newAccountIdentity();
  await store.saveAccountKey(aik);
  const list = await publishDeviceList(store, http, user, aik, { add: [add], fresh: true });
  await pinSelf(store, user, aik);
  await store.saveDevice({ ...device, primary: true, listed: true });
  await store.saveSetting('joinedAt', list.publishedAt); // older messages were never encrypted for this device
}

/** Restored from a backup: keep the same account key (and security code) and add this device. */
export async function adoptAccountKey(store: EncryptedStore, http: E2EHttp, user: string, aik: KeyPair): Promise<void> {
  if (!eq(ed25519.getPublicKey(aik.priv), aik.pub)) throw new CryptoError('bad_signature', 'The account key is damaged');
  const { device, add } = await selfKeys(store);
  await store.saveAccountKey(aik);
  const list = await publishDeviceList(store, http, user, aik, { add: [add] });
  await pinSelf(store, user, aik);
  await store.saveDevice({ ...device, primary: true, listed: true });
  await store.saveSetting('joinedAt', list.publishedAt); // older messages were never encrypted for this device
}

/** Logging out: take this device off the list (if other devices stay), so nobody encrypts to it any more. */
export async function leaveDeviceList(store: EncryptedStore, http: E2EHttp, user: string): Promise<void> {
  const aik = await store.accountKey();
  const device = await store.device();
  if (!aik || !device?.deviceId || !device.listed) return;
  const list = await currentList(http, user);
  if (!list || list.aik !== b64(aik.pub) || !list.devices.some((d) => d.id === device.deviceId)) return;
  if (list.devices.length === 1) return; // the last device: keep the list so contacts keep the account key
  await publishDeviceList(store, http, user, aik, { remove: [device.deviceId] });
}

/**
 * Settings → Sessions → Log out on another of your devices: the server ends its sign-in and forgets
 * it, then this device publishes the account's list without it (so nobody encrypts to it any more).
 */
export async function logOutOtherDevice(store: EncryptedStore, http: E2EHttp, user: string, deviceId: number): Promise<void> {
  const device = await store.device();
  if (device?.deviceId === deviceId) throw new CryptoError('bad_format', 'Use Log out for this device');
  await http.del(`/e2e/v2/devices/${deviceId}`);
  const aik = await store.accountKey();
  const list = await currentList(http, user);
  if (aik && list && list.aik === b64(aik.pub) && list.devices.some((d) => d.id === deviceId)) {
    await publishDeviceList(store, http, user, aik, { remove: [deviceId] });
  }
}

// ---------------------------------------------------------------- new device

export interface PendingDeviceLink {
  request: LinkRequestView;
  qrText: string;
  code: string; // 16 characters
  ek: KeyPair; // one-off; only this device can open the grant with it
}

export async function startDeviceLink(store: EncryptedStore, http: E2EHttp): Promise<PendingDeviceLink> {
  const { device, identity } = await selfKeys(store);
  const ek = newX25519();
  const request = await http.post<LinkRequestView>('/e2e/v2/link-requests', { device_id: device.deviceId, ek: b64(ek.pub) });
  const offer: LinkOffer = { requestId: request.id, ek: ek.pub, identitySign: identity.sign.pub, identityDh: identity.dh.pub };
  return { request, qrText: linkQrText(offer), code: linkCodeV2(offer), ek };
}

/**
 * Wait until another device approves, then check and keep what it sent. Resolves with the grant
 * (the caller restores the version 1 keys and the history from it), or null if the request expired
 * or `cancelled()` became true.
 */
export async function waitForGrant(
  store: EncryptedStore, http: E2EHttp, user: string, link: PendingDeviceLink, cancelled: () => boolean, intervalMs = 2000,
): Promise<GrantPayload | null> {
  while (!cancelled()) {
    let status: LinkRequestView;
    try {
      status = await http.get<LinkRequestView>(`/e2e/v2/link-requests/${link.request.id}`);
    } catch (e) {
      if (httpStatus(e) === 404) return null; // expired
      await sleep(intervalMs); // offline for a moment
      continue;
    }
    if (status.status === 'approved' && status.grant) {
      const payload = openGrant(status.grant, link.ek);
      link.ek.priv.fill(0);
      await acceptGrant(store, http, user, payload);
      return payload;
    }
    await sleep(intervalMs);
  }
  return null;
}

async function acceptGrant(store: EncryptedStore, http: E2EHttp, user: string, payload: GrantPayload): Promise<void> {
  const { device, identity } = await selfKeys(store);
  if (payload.account.user !== user) throw new CryptoError('bad_signature', 'This link is for another account');
  const aik: KeyPair = { pub: unb64(payload.account.aik), priv: unb64(payload.account.aikPriv) };
  if (!eq(ed25519.getPublicKey(aik.priv), aik.pub)) throw new CryptoError('bad_signature', 'The account key is damaged');
  // The list must be signed by that key, include this device with exactly its keys, and be the one now published
  const devices = verifyDeviceList(payload.deviceList, user, aik.pub);
  const me = devices.find((d) => d.id === device.deviceId);
  if (!me || me.sign !== b64(identity.sign.pub) || me.dh !== b64(identity.dh.pub)) {
    throw new CryptoError('bad_signature', "The other device didn't add this one to the account");
  }
  const published = await currentList(http, user);
  if (!published || published.aik !== payload.account.aik) throw new CryptoError('bad_signature', 'The account key on the server is different');

  await store.transaction(async (tx) => {
    await tx.saveAccountKey(aik);
    await tx.saveDeviceList(user, payload.deviceList);
    await tx.savePin(user, { aik: payload.account.aik, verified: true, firstSeen: Date.now() });
    for (const p of payload.pins) {
      if (p.user !== user && !(await tx.pin(p.user))) await tx.savePin(p.user, { aik: p.aik, verified: p.verified, firstSeen: Date.now() });
    }
    await tx.saveDevice({ ...device, primary: true, listed: true });
    await tx.saveSetting('joinedAt', payload.joinedAt || Date.now());
  });
}

// ---------------------------------------------------------------- linked device approving a new one

export interface FoundDeviceLink {
  request: LinkRequestView;
  offer: LinkOffer;
}

function offerOf(r: LinkRequestView): LinkOffer {
  return { requestId: r.id, ek: unb64(r.ek), identitySign: unb64(r.sign), identityDh: unb64(r.dh) };
}

/** Scanned QR: its keys must be exactly the ones the server has for the request. */
export async function findLinkByQr(http: E2EHttp, text: string): Promise<FoundDeviceLink | null> {
  const scanned = parseLinkQr(text.trim());
  if (!scanned) return null; // not a version 2 code
  const request = await http.get<LinkRequestView>(`/e2e/v2/link-requests/${scanned.requestId}`);
  const offer = offerOf(request);
  if (!eq(offer.ek, scanned.ek) || !eq(offer.identitySign, scanned.identitySign) || !eq(offer.identityDh, scanned.identityDh)) {
    throw new CryptoError('bad_signature', "This code doesn't match. Start again on the new device.");
  }
  return { request, offer };
}

/** Typed code: must be the fingerprint of the keys the server hands back. Null if no version 2 request has it. */
export async function findLinkByCode(http: E2EHttp, typed: string): Promise<FoundDeviceLink | null> {
  const code = typed.toUpperCase().replace(/[^A-Z2-7]/g, '');
  if (code.length !== 16) throw new CryptoError('bad_format', 'The code has 16 letters and numbers');
  let request: LinkRequestView;
  try {
    request = await http.get<LinkRequestView>('/e2e/v2/link-requests', { code });
  } catch (e) {
    if (httpStatus(e) === 404) return null;
    throw e;
  }
  const offer = offerOf(request);
  if (linkCodeV2(offer) !== code) throw new CryptoError('bad_signature', "This code doesn't match. Start again on the new device.");
  return { request, offer };
}

/**
 * Add the new device to the account (signed list), and send it everything it needs, encrypted for it
 * alone. `history`: the uploaded, encrypted message history (see exportHistory); `v1`: the account's
 * version 1 keys.
 */
export async function approveDeviceLink(
  store: EncryptedStore, http: E2EHttp, user: string, found: FoundDeviceLink,
  extras: { history?: GrantPayload['history']; historyFile?: string; v1?: GrantPayload['v1'] } = {},
): Promise<DeviceList> {
  const aik = await store.accountKey();
  if (!aik) throw new CryptoError('no_session', "This device can't add others. Use the device you set up first.");
  const { request, offer } = found;
  const list = await publishDeviceList(store, http, user, aik, {
    add: [{ id: request.device_id, sign: offer.identitySign, dh: offer.identityDh, dhSig: unb64(request.dhSig) }],
  });
  const { publishedAt, ...signed } = list;
  const added = signed.devices.find((d) => d.id === request.device_id)!;
  const pins = (await store.pins()).map((p) => ({ user: p.user, aik: p.pin.aik, verified: p.pin.verified }));
  const payload: GrantPayload = {
    account: { user, aik: b64(aik.pub), aikPriv: b64(aik.priv) },
    device: { id: added.id, cert: added.cert, created: added.created },
    deviceList: signed,
    joinedAt: publishedAt,
    pins,
    history: extras.history,
    v1: extras.v1,
  };
  // historyFile (the plain URL of the uploaded history) lets the server delete it once it's been downloaded
  await http.post(`/e2e/v2/link-requests/${request.id}/grant`, { grant: sealGrant(request.id, offer.ek, payload), history_url: extras.historyFile });
  return signed;
}

// ---------------------------------------------------------------- history

interface HistoryFile { v: 1; user: string; created: number; messages: LocalMessage[]; pins: { user: string; pin: Pin }[] }

/** Everything in this device's message database, as bytes to encrypt (encryptMedia) and upload. */
export async function exportHistory(store: EncryptedStore, user: string): Promise<{ bytes: Uint8Array; count: number }> {
  const messages = await store.exportMessages();
  const file: HistoryFile = { v: 1, user, created: Date.now(), messages, pins: await store.pins() };
  return { bytes: utf8(JSON.stringify(file)), count: messages.length };
}

/** On the new device, after decryptMedia: add the messages to the local database. Returns how many were new. */
export async function importHistory(store: EncryptedStore, user: string, bytes: Uint8Array): Promise<number> {
  const file = JSON.parse(fromUtf8(bytes)) as HistoryFile;
  if (file.v !== 1 || file.user !== user) throw new CryptoError('bad_format', 'This history is for another account');
  return store.importMessages(file.messages || []);
}

/** The new device has its history: the server can delete the encrypted copy. */
export async function historyDownloaded(store: EncryptedStore, http: E2EHttp): Promise<void> {
  const device = await store.device();
  if (device?.deviceId) await http.del(`/e2e/v2/devices/${device.deviceId}/history`);
}
