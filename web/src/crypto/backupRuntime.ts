// src/crypto/backupRuntime.ts
// The browser side of the optional encrypted backup (crypto/backup.ts): turning it on, backing up
// once a day in the background, and restoring on a browser with no other device to link from.

import api from '../utils/axios';
import { mediaService } from '../services/media.service';
import { resolveMediaUrl } from '../utils/media';
import { keysFromSecret, keysToSecret, publicKeysOf, toBase64, fromBase64 } from './e2e';
import { e2eSession } from './session';
import { BackupContent, BackupKey, BackupMeta, backupKeyFrom, checkRecoveryKey, openBackup, sealBackup } from './backup';
import { startV2 } from './v2-platform/runtime';
import { restoreAccountKeyV2 } from './v2-platform/link';
import { b64 } from './v2';

const DAY_MS = 24 * 3600e3;

export interface BackupStatus extends Partial<BackupMeta> {
  exists: boolean;
  created_at?: string;
  thisDevice: boolean; // this browser has the key and backs up automatically
}

async function serverBackup(): Promise<{ exists: boolean } & Partial<BackupMeta> & { created_at?: string }> {
  return (await api.get('/api/v1/e2e/backup')).data.data;
}

async function deviceStore(userId: string) {
  return (await startV2(userId)).store;
}

export async function backupStatus(userId: string): Promise<BackupStatus> {
  const [server, key] = await Promise.all([serverBackup(), deviceStore(userId).then((s) => s.setting<BackupKey>('backupKey')).catch(() => null)]);
  return { ...server, thisDevice: !!key && key.verifier === server.verifier };
}

/** Make a backup now with the key this browser keeps. */
export async function runBackup(userId: string): Promise<void> {
  const store = await deviceStore(userId);
  const key = await store.setting<BackupKey>('backupKey');
  const keys = e2eSession.keys();
  if (!key) throw new Error('Backups aren\'t set up on this browser');
  const aik = await store.accountKey();
  const content: BackupContent = {
    v: 1, user: userId, created: Date.now(),
    ...(keys ? { v1Secret: toBase64(keysToSecret(keys)), v1EncPublic: publicKeysOf(keys).enc } : {}), // version 1: only accounts that had it
    messages: await store.exportMessages(), pins: await store.pins(),
    aik: aik ? { pub: b64(aik.pub), priv: b64(aik.priv) } : undefined,
  };
  const { blob, meta } = sealBackup(key, content);
  const uploaded = await mediaService.upload(new File([blob], 'backup.enc', { type: 'application/octet-stream' }), undefined, { encrypted: 'backup' });
  await api.put('/api/v1/e2e/backup', { ...meta, url: uploaded.url });
  await store.saveSetting('lastBackup', Date.now());
}

/** Turn backups on with a new recovery key (the person has written it down), and back up now. */
export async function turnOnBackup(userId: string, recoveryKey: string): Promise<void> {
  const store = await deviceStore(userId);
  await store.saveSetting('backupKey', backupKeyFrom(recoveryKey));
  await runBackup(userId);
}

/** Backups exist but this browser doesn't have the key: enter it to back up from here too. */
export async function adoptRecoveryKey(userId: string, recoveryKey: string): Promise<void> {
  const server = await serverBackup();
  if (!server.exists) throw new Error('There is no backup yet');
  const key = checkRecoveryKey(recoveryKey, server as BackupMeta);
  await (await deviceStore(userId)).saveSetting('backupKey', key);
}

export async function turnOffBackup(userId: string): Promise<void> {
  await api.delete('/api/v1/e2e/backup');
  const store = await deviceStore(userId);
  await store.saveSetting('backupKey', null);
}

/** In the background after sign-in: back up if this browser does backups and the last is a day old. */
export async function backupIfDue(userId: string): Promise<void> {
  const store = await deviceStore(userId);
  if (!(await store.setting<BackupKey>('backupKey'))) return;
  const last = (await store.setting<number>('lastBackup')) || 0;
  if (Date.now() - last > DAY_MS) await runBackup(userId);
}

/**
 * New browser, no other device: restore the account keys (and v2 history) from the backup.
 * Returns how many messages were restored into this browser.
 */
export async function restoreFromBackup(userId: string, recoveryKey: string, currentEncPublic?: string): Promise<number> {
  const server = await serverBackup();
  if (!server.exists || !server.url) throw new Error('There is no backup for this account');
  const key = checkRecoveryKey(recoveryKey, server as BackupMeta);
  const response = await fetch(resolveMediaUrl(server.url)!);
  if (!response.ok) throw new Error("Couldn't download the backup");
  const content = openBackup(key, server as BackupMeta, new Uint8Array(await response.arrayBuffer()));
  // Version 1 keys (older messages) come back only if they're still the account's current ones
  if (content.v1Secret && currentEncPublic && content.v1EncPublic === currentEncPublic) {
    await e2eSession.set(userId, keysFromSecret(fromBase64(content.v1Secret)));
  }
  const store = await deviceStore(userId);
  await store.saveSetting('backupKey', key); // keep backing up from here
  for (const p of content.pins || []) await store.savePin(p.user, p.pin);
  await restoreAccountKeyV2(userId, content.aik); // back on the account's device list
  return store.importMessages(content.messages || []);
}
