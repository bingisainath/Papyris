// src/components/organisms/EncryptionSettings.tsx
// Settings: end-to-end encryption is on; link a new device (it shows a code, typed here).

import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import { findByCode } from '../../crypto/v2-platform/link';
import type { FoundDevice } from '../../crypto/v2-platform/link';
import { parseApiError } from '../../utils/apiError';
import { useAuth } from '../../app/AuthProvider';

const EncryptionSettings: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const { user } = useAuth();
  const [found, setFound] = useState<FoundDevice | null>(null);
  const [sendHistory, setSendHistory] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setOpen(false);
    setCode('');
    setFound(null);
    setError('');
  };

  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setFound(await findByCode(user!.id, code));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const link = async () => {
    if (!found) return;
    setBusy(true);
    setError('');
    try {
      await found.approve(sendHistory);
      toast.success(`${found.name} is linked`);
      reset();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex gap-3">
          <ShieldCheck className="w-6 h-6 text-primary-600 flex-shrink-0" strokeWidth={1.75} />
          <div>
            <h2 className="text-lg font-semibold text-muted-900">End-to-end encryption</h2>
            <p className="text-sm text-muted-500">
              On. Messages, photos, videos, voice messages and files in chats where everyone has set it up are encrypted on
              your devices. Expenses, receipt scans and group names and photos aren't: the server needs them to work out
              balances and show your chats.
            </p>
          </div>
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)}
            className="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg">
            Link a device
          </button>
        )}
      </div>

      {open && !found && (
        <form onSubmit={find} className="mt-4 max-w-sm space-y-2">
          <p className="text-sm text-muted-600">Sign in on the new phone or browser. It shows a QR code and a 16-character code: type the code here.</p>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABCD-EFGH-IJKL-MNOP" autoFocus aria-label="Link code"
            className="w-full px-3 py-2 rounded-lg border border-muted-300 bg-white font-mono tracking-wider uppercase focus:outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100" />
          {error && <p className="text-sm text-accent-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || code.replace(/[^a-z0-9]/gi, '').length < 16} className="px-4 py-2 rounded-lg bg-primary-700 text-white text-sm disabled:opacity-50">
              {busy ? 'Finding…' : 'Continue'}
            </button>
            <button type="button" onClick={reset} className="px-3 py-2 text-sm text-muted-600">Cancel</button>
          </div>
        </form>
      )}

      {found && (
        <div className="mt-4 max-w-sm p-4 rounded-xl border border-muted-200">
          <p className="text-sm text-muted-900">Link <span className="font-semibold">{found.name}</span>?</p>
          <p className="mt-1 text-xs text-muted-500">It will be able to read all your end-to-end encrypted chats. Only continue if it's your own device and you just signed in on it.</p>
          <label className="mt-3 flex items-start gap-2 text-sm text-muted-700">
            <input type="checkbox" checked={sendHistory} onChange={(e) => setSendHistory(e.target.checked)} className="mt-0.5" />
            <span>Send my message history<span className="block text-xs text-muted-500">Encrypted so only that device can open it.</span></span>
          </label>
          {error && <p className="mt-2 text-sm text-accent-600">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={link} disabled={busy} className="px-4 py-2 rounded-lg bg-primary-700 text-white text-sm disabled:opacity-50">
              {busy ? 'Linking…' : 'Link device'}
            </button>
            <button type="button" onClick={reset} className="px-3 py-2 text-sm text-muted-600">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EncryptionSettings;
