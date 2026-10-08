// src/crypto/v2-platform/runtime.ts
// Starts encryption v2 for the signed-in account on this phone, in the background: the device
// registers its keys and keeps prekeys topped up (phase 3). Sending still uses v1 until phase 4.

import { AppState } from 'react-native';
import { api } from '../../api/client';
import { DeviceManager, EncryptedStore } from '../v2';
import type { DeviceState, E2EHttp } from '../v2';
import { openSqliteKV } from './sqliteKV';
import { phoneName } from '../../screens/auth/E2EGate';

const http: E2EHttp = {
  get: async (path, params) => (await api.get(path, { params })).data.data,
  post: async (path, body) => (await api.post(path, body)).data.data,
  put: async (path, body) => (await api.put(path, body)).data.data,
  del: async (path) => (await api.delete(path)).data.data,
};

interface Runtime { userId: string; store: EncryptedStore; manager: DeviceManager; state: DeviceState }

let current: Promise<Runtime> | null = null;
let stopWatching: (() => void) | null = null;

export function startV2(userId: string): Promise<Runtime> {
  if (current) {
    return current.then((r) => (r.userId === userId ? r : stopV2(false).then(() => startV2(userId))));
  }
  current = (async () => {
    const store = new EncryptedStore(await openSqliteKV());
    const manager = new DeviceManager(store, http, userId, phoneName());
    const state = await manager.bootstrap();
    // Top up prekeys whenever the app comes back to the foreground
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') manager.ensurePrekeys().catch(() => undefined);
    });
    stopWatching = () => sub.remove();
    return { userId, store, manager, state };
  })();
  current.catch(() => { current = null; }); // try again next time
  return current;
}

/** On logout: forget this device on the server and wipe its local keys and messages. */
export async function stopV2(logout = true): Promise<void> {
  const running = current;
  current = null;
  stopWatching?.();
  stopWatching = null;
  if (!running) return;
  const r = await running.catch(() => null);
  if (r && logout) await r.manager.logout();
}

export const v2Runtime = (): Promise<Runtime> | null => current;
