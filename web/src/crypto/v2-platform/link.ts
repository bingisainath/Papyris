// src/crypto/v2-platform/link.ts
// Linking devices in the browser, for both encryption versions behind one interface:
// - accounts with a version 2 device list link the version 2 way (the grant also carries the
//   version 1 keys and, optionally, the message history, encrypted for the new device only);
// - otherwise the version 1 way (crypto/linking.ts).

import {
  adoptAccountKey, approveDeviceLink, logOutOtherDevice, decryptMedia, encryptMedia, exportHistory, findLinkByCode, findLinkByQr, historyDownloaded,
  importHistory, startDeviceLink, startFreshAccount, unb64, waitForGrant,
} from '../v2';
import type { DeviceList, FoundDeviceLink, GrantPayload, KeyPair } from '../v2';
import { b64, httpStatus, loadDeviceIdentity } from '../v2';
import { http, startV2 } from './runtime';
import * as v1 from '../linking';
import { formatLinkCode, fromBase64, keysFromSecret, keysToSecret, publicKeysOf, toBase64 } from '../e2e';
import { e2eSession } from '../session';
import { mediaService } from '../../services/media.service';
import { resolveMediaUrl } from '../../utils/media';

// ---------------------------------------------------------------- the new device

/**
 * Is this browser on the account's published device list (with its own keys)? 'none' when the
 * account has no version 2 list, 'orphaned' when every device on it has logged out (nobody is left
 * to approve this one).
 */
export async function listStatus(userId: string): Promise<'listed' | 'not_listed' | 'orphaned' | 'none'> {
  const rt = await startV2(userId);
  let list: DeviceList;
  try {
    list = await http.get<DeviceList>(`/e2e/v2/users/${userId}/device-list`);
  } catch (e) {
    if (httpStatus(e) === 404) return 'none';
    throw e;
  }
  const device = await rt.store.device();
  const sign = device ? b64(loadDeviceIdentity(device.identity).sign.pub) : null;
  const listed = list.devices.some((d) => d.id === rt.state.deviceId && d.sign === sign);
  rt.state.listed = listed;
  if (device && device.listed !== listed) await rt.store.saveDevice({ ...device, listed });
  if (listed) return 'listed';
  const mine = await http.get<{ devices: { device_id: number; sign: string }[] }>('/e2e/v2/devices/me');
  const active = list.devices.some((d) => mine.devices.some((m) => m.device_id === d.id && m.sign === d.sign));
  return active ? 'not_listed' : 'orphaned';
}

export interface LinkHere {
  qrText: string;
  code: string; // formatted, e.g. ABCD-EFGH-IJKL-MNOP
  /** Resolves 'done' once the keys (and history) are in, 'expired' when the code ran out. */
  wait: (cancelled: () => boolean) => Promise<'done' | 'expired'>;
}

/** Show a code on this browser for another of the account's devices to approve. */
export async function linkHere(userId: string, encPublic: string, deviceName: string): Promise<LinkHere> {
  const rt = await startV2(userId);
  if ((await listStatus(userId)) !== 'not_listed') {
    // No version 2 device list to join (this browser just became the account's first v2 device): version 1 linking
    const pending = await v1.startLink(deviceName);
    return {
      qrText: pending.qrText,
      code: formatLinkCode(pending.code),
      wait: async (cancelled) => {
        const keys = await v1.waitForKeys(pending, encPublic, cancelled);
        if (!keys) return 'expired';
        await e2eSession.set(userId, keys);
        return 'done';
      },
    };
  }
  const pending = await startDeviceLink(rt.store, http);
  return {
    qrText: pending.qrText,
    code: formatLinkCode(pending.code),
    wait: async (cancelled) => {
      const grant = await waitForGrant(rt.store, http, userId, pending, cancelled);
      if (!grant) return 'expired';
      await applyGrant(userId, encPublic, grant);
      return 'done';
    },
  };
}

async function applyGrant(userId: string, encPublic: string, grant: GrantPayload) {
  const rt = await startV2(userId);
  rt.state.listed = true;
  rt.messenger.forget();
  if (grant.v1) {
    const keys = keysFromSecret(fromBase64(grant.v1.secret));
    if (publicKeysOf(keys).enc !== encPublic) throw new Error("The keys from the other device don't match this account");
    await e2eSession.set(userId, keys);
  }
  if (grant.history) {
    try {
      const response = await fetch(resolveMediaUrl(grant.history.url)!);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await importHistory(rt.store, userId, decryptMedia(new Uint8Array(await response.arrayBuffer()), grant.history));
      await historyDownloaded(rt.store, http).catch(() => undefined);
    } catch (e) {
      console.warn("Couldn't load the message history from the other device:", e);
    }
  }
}

// ---------------------------------------------------------------- a linked device approving

export interface FoundDevice {
  name: string;
  /** Add the device; `sendHistory` also sends it this browser's message history. */
  approve: (sendHistory: boolean) => Promise<void>;
}

function v2Found(userId: string, found: FoundDeviceLink): FoundDevice {
  return {
    name: found.request.name,
    approve: async (sendHistory) => {
      const rt = await startV2(userId);
      let history: GrantPayload['history'];
      let historyFile: string | undefined;
      if (sendHistory) {
        const { bytes, count } = await exportHistory(rt.store, userId);
        const sealed = encryptMedia(bytes);
        const uploaded = await mediaService.upload(new File([sealed.blob], 'history.enc', { type: 'application/octet-stream' }), undefined, { encrypted: 'backup' });
        // The signed URL lets the new device download it; the server deletes the file once it has
        history = { url: uploaded.signedUrl, key: sealed.key, sha256: sealed.sha256, size: sealed.size, count };
        historyFile = uploaded.url;
      }
      const keys = e2eSession.keys();
      const v1Keys = keys ? { secret: toBase64(keysToSecret(keys)), encPublic: publicKeysOf(keys).enc } : undefined;
      await approveDeviceLink(rt.store, http, userId, found, { history, historyFile, v1: v1Keys });
      rt.messenger.forget(userId);
    },
  };
}

function v1Found(found: v1.FoundLink): FoundDevice {
  return { name: found.request.device_name, approve: () => v1.approve(found) };
}

/** Typed 16-character code shown by the new device. */
export async function findByCode(userId: string, code: string): Promise<FoundDevice> {
  await startV2(userId);
  const found = await findLinkByCode(http, code);
  return found ? v2Found(userId, found) : v1Found(await v1.findByCode(code));
}

/** Scanned QR code shown by the new device. */
export async function findByQr(userId: string, text: string): Promise<FoundDevice> {
  await startV2(userId);
  const found = await findLinkByQr(http, text);
  return found ? v2Found(userId, found) : v1Found(await v1.findByQr(text));
}

// ---------------------------------------------------------------- no other device

/** Start fresh: new version 2 account key with just this browser (version 1 keys are replaced separately). */
export async function startFreshV2(userId: string): Promise<void> {
  const rt = await startV2(userId);
  await startFreshAccount(rt.store, http, userId);
  rt.state.listed = true;
  rt.messenger.forget();
}

/** Restored from a backup: the account key from it, or a fresh one for backups made before it was included. */
export async function restoreAccountKeyV2(userId: string, aik?: { pub: string; priv: string }): Promise<void> {
  const rt = await startV2(userId);
  const status = await listStatus(userId);
  if (status === 'listed') return; // this browser is already on the list
  if (aik) {
    const current = await http.get<DeviceList>(`/e2e/v2/users/${userId}/device-list`).catch(() => null);
    if (current && current.aik !== aik.pub && status === 'not_listed') {
      // Another device is signed in with newer keys: going back to the backup's would undo them
      throw new Error("This backup is older than your account's current keys. Link this browser from your other device instead.");
    }
    const pair: KeyPair = { pub: unb64(aik.pub), priv: unb64(aik.priv) };
    await adoptAccountKey(rt.store, http, userId, pair);
  } else {
    await startFreshAccount(rt.store, http, userId);
  }
  rt.state.listed = true;
  rt.messenger.forget();
}

/** Settings → Sessions → Log out on another of your devices. */
export async function logOutDevice(userId: string, deviceId: number): Promise<void> {
  const rt = await startV2(userId);
  await logOutOtherDevice(rt.store, http, userId, deviceId);
  rt.messenger.forget(userId);
}
