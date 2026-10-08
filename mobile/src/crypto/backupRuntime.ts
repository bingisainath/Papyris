// src/crypto/backupRuntime.ts
// The phone side of the optional encrypted backup (crypto/backup.ts): turning it on, backing up
// once a day in the background, and restoring on a phone with no other device to link from.
// Same behaviour as web/src/crypto/backupRuntime.ts.

import ReactNativeBlobUtil from 'react-native-blob-util';
import { api } from '../api/client';
import { uploadFile } from '../api/media';
import { mediaUrl } from '../config';
import { fromBase64, keysFromSecret, keysToSecret, publicKeysOf, toBase64 } from './e2e';
import { e2eSession } from './session';
import { BackupContent, BackupKey, BackupMeta, backupKeyFrom, checkRecoveryKey, openBackup, sealBackup } from './backup';
import { startV2, v2Runtime } from './v2-platform/runtime';

const DAY_MS = 24 * 3600e3;
const fs = ReactNativeBlobUtil.fs;

export interface BackupStatus extends Partial<BackupMeta> {
  exists: boolean;
  created_at?: string;
  thisDevice: boolean;
}

async function serverBackup(): Promise<{ exists: boolean } & Partial<BackupMeta> & { created_at?: string }> {
  return (await api.get('/e2e/backup')).data.data;
}

const deviceStore = async (userId: string) => (await startV2(userId)).store;

export async function backupStatus(userId: string): Promise<BackupStatus> {
  const [server, key] = await Promise.all([serverBackup(), deviceStore(userId).then((s) => s.setting<BackupKey>('backupKey')).catch(() => null)]);
  return { ...server, thisDevice: !!key && key.verifier === server.verifier };
}

export async function runBackup(userId: string): Promise<void> {
  const store = await deviceStore(userId);
  const key = await store.setting<BackupKey>('backupKey');
  const keys = e2eSession.keys();
  if (!key || !keys) throw new Error("Backups aren't set up on this phone");
  const content: BackupContent = {
    v: 1, user: userId, created: Date.now(),
    v1Secret: toBase64(keysToSecret(keys)), v1EncPublic: publicKeysOf(keys).enc,
    messages: await store.exportMessages(), pins: await store.pins(),
  };
  const { blob, meta } = sealBackup(key, content);
  const path = `${fs.dirs.CacheDir}/backup-${Date.now()}.enc`;
  await fs.writeFile(path, toBase64(blob), 'base64');
  try {
    const uploaded = await uploadFile({ uri: `file://${path}`, type: 'application/octet-stream', name: 'backup.enc' }, { encrypted: 'backup' });
    await api.put('/e2e/backup', { ...meta, url: uploaded.url });
  } finally {
    await fs.unlink(path).catch(() => undefined);
  }
  await store.saveSetting('lastBackup', Date.now());
}

export async function turnOnBackup(userId: string, recoveryKey: string): Promise<void> {
  await (await deviceStore(userId)).saveSetting('backupKey', backupKeyFrom(recoveryKey));
  await runBackup(userId);
}

export async function adoptRecoveryKey(userId: string, recoveryKey: string): Promise<void> {
  const server = await serverBackup();
  if (!server.exists) throw new Error('There is no backup yet');
  await (await deviceStore(userId)).saveSetting('backupKey', checkRecoveryKey(recoveryKey, server as BackupMeta));
}

export async function turnOffBackup(userId: string): Promise<void> {
  await api.delete('/e2e/backup');
  await (await deviceStore(userId)).saveSetting('backupKey', null);
}

export async function backupIfDue(userId: string): Promise<void> {
  const store = await deviceStore(userId);
  if (!(await store.setting<BackupKey>('backupKey'))) return;
  const last = (await store.setting<number>('lastBackup')) || 0;
  if (Date.now() - last > DAY_MS) await runBackup(userId);
}

export async function restoreFromBackup(userId: string, recoveryKey: string, currentEncPublic: string): Promise<number> {
  const server = await serverBackup();
  if (!server.exists || !server.url) throw new Error('There is no backup for this account');
  const key = checkRecoveryKey(recoveryKey, server as BackupMeta);
  const path = `${fs.dirs.CacheDir}/restore-${Date.now()}.enc`;
  let blob: Uint8Array;
  try {
    const response = await ReactNativeBlobUtil.config({ path }).fetch('GET', mediaUrl(server.url)!);
    if (response.info().status !== 200) throw new Error("Couldn't download the backup");
    blob = fromBase64(await fs.readFile(path, 'base64'));
  } finally {
    await fs.unlink(path).catch(() => undefined);
  }
  const content = openBackup(key, server as BackupMeta, blob);
  if (!content.v1Secret || content.v1EncPublic !== currentEncPublic) {
    throw new Error("This backup was made before your encryption keys were replaced, so it can't restore them");
  }
  await e2eSession.set(userId, keysFromSecret(fromBase64(content.v1Secret)));
  const store = await deviceStore(userId);
  await store.saveSetting('backupKey', key);
  for (const p of content.pins || []) await store.savePin(p.user, p.pin);
  return store.importMessages(content.messages || []);
}

/** Before logging out: is this the only signed-in device, and is there a backup? */
export async function logoutRisk(): Promise<{ lastDevice: boolean; hasBackup: boolean }> {
  const [devices, backup, me] = await Promise.all([
    api.get('/e2e/v2/devices/me').then((r) => r.data.data.devices as { device_id: number }[]).catch(() => [] as { device_id: number }[]),
    serverBackup().then((b) => b.exists).catch(() => false),
    v2Runtime()?.then((r) => r.state.deviceId).catch(() => null) ?? Promise.resolve(null),
  ]);
  return { lastDevice: devices.filter((d) => d.device_id !== me).length === 0, hasBackup: backup };
}
