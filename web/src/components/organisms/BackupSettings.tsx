// src/components/organisms/BackupSettings.tsx
// Settings → Encrypted backup: turn it on (shows a 64-digit recovery key once), back up now, use the
// key on this browser too, or turn it off.

import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Download, HardDriveUpload } from 'lucide-react';
import { toast } from 'react-toastify';
import { formatRecoveryKey, isRecoveryKey, newRecoveryKey } from '../../crypto/backup';
import { backupStatus, runBackup, turnOffBackup, turnOnBackup, adoptRecoveryKey } from '../../crypto/backupRuntime';
import type { BackupStatus } from '../../crypto/backupRuntime';
import { formatFileSize } from '../../utils/media';
import { parseApiError } from '../../utils/apiError';

const BackupSettings: React.FC<{ userId: string }> = ({ userId }) => {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [typed, setTyped] = useState('');
  const [entering, setEntering] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    backupStatus(userId).then(setStatus).catch(() => setStatus(null));
  }, [userId]);
  useEffect(load, [load]);

  const act = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(done);
      setNewKey(null);
      setSaved(false);
      setEntering(false);
      setTyped('');
      load();
    } catch (error) {
      toast.error(parseApiError(error));
    } finally {
      setBusy(false);
    }
  };

  const downloadKey = (key: string) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`Papyris recovery key\n\n${formatRecoveryKey(key)}\n\nKeep it somewhere safe. Anyone with this key and your account can read your backup.\n`], { type: 'text/plain' }));
    link.download = 'papyris-recovery-key.txt';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="card p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <HardDriveUpload className="w-6 h-6 text-primary-600 flex-shrink-0" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-muted-900">Encrypted backup</h2>
          <p className="text-sm text-muted-500">
            If you lose every device, a backup lets you read your encrypted chats again. It's encrypted with a 64-digit recovery key
            that only you have: Papyris can't open it, and can't help if the key is lost.
          </p>

          {status === null ? null : !status.exists && !newKey ? (
            <button type="button" onClick={() => setNewKey(newRecoveryKey())}
              className="mt-3 px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg">
              Turn on backup
            </button>
          ) : newKey ? (
            <div className="mt-3 p-4 rounded-xl border border-muted-200 space-y-3">
              <p className="text-sm text-muted-700">Your recovery key. Write it down or save the file somewhere safe: it won't be shown again.</p>
              <p className="font-mono text-base tracking-wide text-muted-900 break-words select-all" data-testid="recovery-key">{formatRecoveryKey(newKey)}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => { navigator.clipboard?.writeText(formatRecoveryKey(newKey)); toast.info('Copied'); }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-muted-100 hover:bg-muted-200"><Copy className="w-4 h-4" /> Copy</button>
                <button type="button" onClick={() => downloadKey(newKey)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-muted-100 hover:bg-muted-200"><Download className="w-4 h-4" /> Save as file</button>
              </div>
              <label className="flex items-start gap-2 text-sm text-muted-700">
                <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5" />
                I've saved my recovery key
              </label>
              <div className="flex gap-2">
                <button type="button" disabled={!saved || busy} onClick={() => act(() => turnOnBackup(userId, newKey), 'Backup turned on')}
                  className="px-4 py-2 rounded-lg bg-primary-700 text-white text-sm disabled:opacity-50">{busy ? 'Backing up…' : 'Turn on and back up now'}</button>
                <button type="button" onClick={() => setNewKey(null)} className="px-3 py-2 text-sm text-muted-600">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted-700">
                On. Last backup {status.created_at ? new Date(status.created_at).toLocaleString() : '—'}
                {status.size ? ` · ${formatFileSize(status.size)}` : ''}.
                {status.thisDevice ? ' This browser backs up once a day.' : ''}
              </p>
              {!status.thisDevice && !entering && (
                <button type="button" onClick={() => setEntering(true)} className="text-sm text-primary-700 hover:underline">
                  Back up from this browser too (needs your recovery key)
                </button>
              )}
              {entering && (
                <div className="flex gap-2 max-w-xl">
                  <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="64-digit recovery key" aria-label="Recovery key"
                    className="flex-1 px-3 py-2 rounded-lg border border-muted-300 font-mono text-sm" />
                  <button type="button" disabled={!isRecoveryKey(typed) || busy} onClick={() => act(() => adoptRecoveryKey(userId, typed), 'This browser will back up too')}
                    className="px-3 py-2 rounded-lg bg-primary-700 text-white text-sm disabled:opacity-50">Use key</button>
                </div>
              )}
              <div className="flex gap-2">
                {status.thisDevice && (
                  <button type="button" disabled={busy} onClick={() => act(() => runBackup(userId), 'Backed up')}
                    className="px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg">{busy ? 'Backing up…' : 'Back up now'}</button>
                )}
                <button type="button" disabled={busy} onClick={() => {
                  if (window.confirm('Turn off backups? The backup is deleted. Without it, losing every device means losing your encrypted chats.')) {
                    act(() => turnOffBackup(userId), 'Backup turned off');
                  }
                }} className="px-3 py-1.5 text-sm text-accent-700 hover:bg-accent-50 rounded-lg">Turn off</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BackupSettings;
