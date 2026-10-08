// src/components/organisms/LogoutWarning.tsx
// Before logging out: if this is the account's only signed-in device, warn that its encrypted chats
// can't be read again afterwards (unless there's a backup to restore with the recovery key).

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import api from '../../utils/axios';
import { v2Runtime } from '../../crypto/v2-platform/runtime';

export interface LogoutRisk { lastDevice: boolean; hasBackup: boolean }

/** Is this the only signed-in device? (If it can't tell, it assumes yes: better an extra warning.) */
export async function logoutRisk(): Promise<LogoutRisk> {
  const [devices, backup, me] = await Promise.all([
    api.get('/api/v1/e2e/v2/devices/me').then((r) => r.data.data.devices as { device_id: number }[]).catch(() => [] as { device_id: number }[]),
    api.get('/api/v1/e2e/backup').then((r) => !!r.data.data.exists).catch(() => false),
    v2Runtime()?.then((r) => r.state.deviceId).catch(() => null) ?? Promise.resolve(null),
  ]);
  const others = devices.filter((d) => d.device_id !== me).length;
  return { lastDevice: others === 0, hasBackup: backup };
}

const LogoutWarning: React.FC<{ risk: LogoutRisk; onCancel: () => void; onConfirm: () => void; onOpenSettings: () => void }> = ({ risk, onCancel, onConfirm, onOpenSettings }) => (
  <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-label="Log out of your only device?">
    <div className="w-full max-w-md bg-white rounded-2xl shadow-elevated p-6">
      <div className="flex gap-3">
        <AlertTriangle className="w-6 h-6 text-warning-600 flex-shrink-0" />
        <div>
          <h2 className="text-lg font-semibold text-muted-900">Log out of your only device?</h2>
          {risk.hasBackup ? (
            <p className="mt-2 text-sm text-muted-600">
              No other phone or browser is signed in. To read your encrypted chats again after logging out, you'll need your
              64-digit backup recovery key. Make sure you have it before you continue.
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-600">
              No other phone or browser is signed in, and you have no backup. If you log out, your end-to-end encrypted chats
              can't be read again, on any device. Turn on an encrypted backup first, or sign in on another device.
            </p>
          )}
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg text-muted-700 hover:bg-muted-100">Cancel</button>
        {!risk.hasBackup && (
          <button type="button" onClick={onOpenSettings} className="px-4 py-2 text-sm rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100">Turn on backup</button>
        )}
        <button type="button" onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-accent-600 text-white hover:bg-accent-700">Log out anyway</button>
      </div>
    </div>
  </div>
);

export default LogoutWarning;
