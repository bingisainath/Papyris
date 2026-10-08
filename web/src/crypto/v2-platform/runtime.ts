// src/crypto/v2-platform/runtime.ts
// Starts encryption v2 for the signed-in account in this browser, in the background: the device
// registers its keys and keeps prekeys topped up (phase 3). Sending still uses v1 until phase 4.

import api from '../../utils/axios';
import { DeviceManager, EncryptedStore, Messenger } from '../v2';
import type { DeviceState, E2EHttp } from '../v2';
import { openIdbKV } from './idbKV';
import { browserName } from '../../app/E2EGate';

const http: E2EHttp = {
  get: async (path, params) => (await api.get(`/api/v1${path}`, { params })).data.data,
  post: async (path, body) => (await api.post(`/api/v1${path}`, body)).data.data,
  put: async (path, body) => (await api.put(`/api/v1${path}`, body)).data.data,
  del: async (path) => (await api.delete(`/api/v1${path}`)).data.data,
};

const PREKEY_CHECK_MS = 6 * 3600e3;

interface Runtime { userId: string; store: EncryptedStore; manager: DeviceManager; state: DeviceState; messenger: Messenger }

let current: Promise<Runtime> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

export function startV2(userId: string): Promise<Runtime> {
  if (current) {
    return current.then((r) => (r.userId === userId ? r : stopV2(false).then(() => startV2(userId))));
  }
  current = (async () => {
    const store = new EncryptedStore(await openIdbKV());
    const manager = new DeviceManager(store, http, userId, browserName());
    const state = await manager.bootstrap();
    if (timer) clearInterval(timer);
    timer = setInterval(() => { manager.ensurePrekeys().catch(() => undefined); }, PREKEY_CHECK_MS);
    const messenger = new Messenger(store, http, { user: userId, device: state.deviceId });
    return { userId, store, manager, state, messenger };
  })();
  current.catch(() => { current = null; }); // try again next time
  return current;
}

/** On logout: forget this device on the server and wipe its local keys and messages. */
export async function stopV2(logout = true): Promise<void> {
  const running = current;
  current = null;
  if (timer) clearInterval(timer);
  timer = null;
  if (!running) return;
  const r = await running.catch(() => null);
  if (r && logout) await r.manager.logout();
}

export const v2Runtime = (): Promise<Runtime> | null => current;
