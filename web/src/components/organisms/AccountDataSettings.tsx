// src/components/organisms/AccountDataSettings.tsx
// Settings → Your data: download everything the server holds about you, or delete the account.

import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { AlertTriangle, Download, KeyRound, Trash2 } from 'lucide-react';
import { deleteMyAccount, downloadMyData } from '../../services/auth.service';
import { parseApiError } from '../../utils/apiError';
import { ACCOUNT_DELETED_EVENT } from '../../utils/authRefresh';

const AccountDataSettings: React.FC = () => {
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadMyData();
      toast.success('Your data was downloaded');
    } catch (error) {
      toast.error(parseApiError(error));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="card p-4 sm:p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-muted-900">Your data</h2>
        <p className="text-sm text-muted-500">Download a copy of what Papyris holds about you, or delete your account.</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-muted-900">Download my data</h3>
          <p className="text-sm text-muted-500">
            Your profile, chats, expenses, payments and receipts as a JSON file. Encrypted messages are only on your
            devices, so the file can't include what they said.
          </p>
        </div>
        <button
          type="button"
          onClick={download}
          disabled={downloading}
          className="flex-shrink-0 inline-flex items-center gap-2 h-10 px-4 text-sm font-bold text-primary-700 bg-primary-50 border border-primary-100 hover:bg-primary-100 rounded-[11px] disabled:opacity-60"
        >
          <Download className="w-4 h-4" /> {downloading ? 'Preparing…' : 'Download'}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-5 border-t border-muted-100">
        <div className="min-w-0">
          <h3 className="font-semibold text-accent-600">Delete account</h3>
          <p className="text-sm text-muted-500">Signs you out everywhere and removes your profile, devices and messages. This can't be undone.</p>
        </div>
        <button
          type="button"
          onClick={() => setDeleting(true)}
          className="flex-shrink-0 inline-flex items-center gap-2 h-10 px-4 text-sm font-bold text-accent-600 bg-accent-50 border border-accent-100 hover:bg-accent-100 rounded-[11px]"
        >
          <Trash2 className="w-4 h-4" /> Delete account
        </button>
      </div>

      {deleting && <DeleteAccountDialog onClose={() => setDeleting(false)} />}
    </div>
  );
};

const DeleteAccountDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = !!password && confirm.trim().toUpperCase() === 'DELETE';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await deleteMyAccount(password, confirm);
      window.dispatchEvent(new Event(ACCOUNT_DELETED_EVENT)); // sign out and wipe this browser
    } catch (err) {
      setError(parseApiError(err));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#18121f]/60 backdrop-blur-[3px] p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-label="Delete your account?"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-[20px] shadow-elevated p-6 space-y-4"
      >
        <div className="flex gap-3">
          <AlertTriangle className="w-6 h-6 text-accent-600 flex-shrink-0" />
          <div>
            <h2 className="font-display text-lg font-semibold text-muted-900">Delete your account?</h2>
            <ul className="mt-2 space-y-1 text-sm text-muted-600 list-disc pl-4">
              <li>Every phone and browser is signed out and wiped; your encrypted chats can't be read again.</li>
              <li>Your profile, photo, devices, backup, settings and what your messages said are removed.</li>
              <li>You leave your groups. Shared expenses and payments stay, shown as "Deleted user", so other people's balances don't change.</li>
              <li>You can sign up again later with the same email, as a new account.</li>
            </ul>
          </div>
        </div>

        <label className="block">
          <span className="block mb-1.5 text-xs font-bold text-muted-500">Your password</span>
          <span className="relative block">
            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full h-11 pl-10 pr-3 rounded-xl border border-muted-200 outline-none focus:border-accent-400 focus:ring-4 focus:ring-accent-50"
            />
          </span>
        </label>
        <label className="block">
          <span className="block mb-1.5 text-xs font-bold text-muted-500">Type DELETE to confirm</span>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            className="w-full h-11 px-3 rounded-xl border border-muted-200 outline-none focus:border-accent-400 focus:ring-4 focus:ring-accent-50 tracking-widest"
          />
        </label>

        {error && <p role="alert" className="text-sm text-accent-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-[11px] text-sm font-semibold text-muted-600 hover:bg-muted-100">Cancel</button>
          <button
            type="submit"
            disabled={!ready || busy}
            className="h-10 px-4 rounded-[11px] text-sm font-bold text-white bg-accent-600 hover:bg-accent-700 disabled:opacity-50"
          >
            {busy ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AccountDataSettings;
