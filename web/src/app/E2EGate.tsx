// src/app/E2EGate.tsx
// After sign-in, before the chats: make sure this browser has the account's encryption keys.
// - First device on the account: keys are created here silently, nothing to do.
// - Another device already has them: show a QR code; the phone (Settings → End-to-end encryption →
//   Link a device) scans it, or the code under it is typed there, and sends the keys over.
// - No other device available: start fresh with new keys; older encrypted messages can't be read.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AlertCircle, Smartphone } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { Loading } from '../components/atoms';
import { formatLinkCode, publicKeysOf } from '../crypto/e2e';
import { e2eSession } from '../crypto/session';
import { startLink, waitForKeys } from '../crypto/linking';
import type { PendingLink } from '../crypto/linking';
import { e2eService } from '../services/e2e.service';
import type { MyKeys } from '../services/e2e.service';
import { parseApiError } from '../utils/apiError';
import { startV2 } from '../crypto/v2-platform/runtime';

type Stage = { name: 'checking' } | { name: 'ready' } | { name: 'link'; mine: MyKeys } | { name: 'error'; message: string };

/** "Chrome on Windows" etc., so the phone can show which device is asking. */
export function browserName(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}

export const E2EGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const [stage, setStage] = useState<Stage>({ name: 'checking' });
  const userId = user?.id;

  const check = useCallback(async () => {
    if (!userId) return;
    setStage({ name: 'checking' });
    try {
      const mine = await e2eService.mine();
      if (!mine.has_keys) {
        // First device on this account: create the keys here, nothing to ask
        await e2eSession.clear();
        await e2eSession.set(userId, await e2eService.setUp());
        setStage({ name: 'ready' });
        return;
      }
      // Keys from an earlier visit, and still the account's current keys?
      if (await e2eSession.restore(userId)) {
        if (publicKeysOf(e2eSession.keys()!).enc === mine.enc_public) {
          setStage({ name: 'ready' });
          return;
        }
        await e2eSession.clear(); // a fresh start on another device since
      }
      setStage({ name: 'link', mine });
    } catch (error) {
      setStage({ name: 'error', message: parseApiError(error) });
    }
  }, [userId]);

  useEffect(() => { check(); }, [check]);

  // Encryption v2 starts in the background once this browser is ready (registers, uploads prekeys)
  useEffect(() => {
    if (stage.name === 'ready' && userId) startV2(userId).catch((e) => console.warn('Encryption v2 setup failed (will retry next start):', e?.message || e));
  }, [stage.name, userId]);

  // Our keys were replaced on another device: link again
  useEffect(() => e2eSession.onStale(() => { e2eSession.clear().then(check); }), [check]);

  if (stage.name === 'ready') return <>{children}</>;

  if (stage.name === 'checking') {
    return (
      <div className="flex items-center justify-center h-screen bg-muted-50">
        <Loading variant="spinner" size="xl" text="Loading…" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted-50 p-4">
      <div className="bg-white border border-muted-200 rounded-2xl shadow-card p-8 w-full max-w-md">
        {stage.name === 'error' ? (
          <>
            <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-accent-50 flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-accent-600" strokeWidth={1.75} />
            </div>
            <h1 className="text-2xl font-semibold text-muted-900 text-center">Couldn't check your encryption</h1>
            <p className="mt-2 text-center text-sm text-muted-600">{stage.message}</p>
            <button type="button" onClick={check} className="mt-6 w-full py-3 rounded-lg bg-primary-700 hover:bg-primary-800 text-white font-medium">Try again</button>
          </>
        ) : (
          <LinkThisDevice mine={stage.mine} userId={userId!} onDone={() => setStage({ name: 'ready' })} />
        )}
        <p className="mt-6 text-center text-sm text-muted-500">
          Signed in as <span className="font-medium text-muted-700">{user?.username}</span> ·{' '}
          <button type="button" onClick={logout} className="text-primary-700 hover:underline">Log out</button>
        </p>
      </div>
    </div>
  );
};

const LinkThisDevice: React.FC<{ mine: MyKeys; userId: string; onDone: () => void }> = ({ mine, userId, onDone }) => {
  const [link, setLink] = useState<PendingLink | null>(null);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState('');
  const [confirmFresh, setConfirmFresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const attempt = useRef(0);

  const begin = useCallback(async () => {
    const mineAttempt = ++attempt.current;
    setExpired(false);
    setError('');
    setLink(null);
    try {
      const pending = await startLink(browserName());
      if (mineAttempt !== attempt.current) return;
      setLink(pending);
      const keys = await waitForKeys(pending, mine.enc_public!, () => mineAttempt !== attempt.current);
      if (mineAttempt !== attempt.current) return;
      if (!keys) {
        setExpired(true);
        return;
      }
      await e2eSession.set(userId, keys);
      onDone();
    } catch (err) {
      if (mineAttempt === attempt.current) setError(parseApiError(err));
    }
  }, [mine.enc_public, userId, onDone]);

  useEffect(() => {
    begin();
    return () => { attempt.current += 1; }; // stop waiting when leaving
  }, [begin]);

  const startFresh = async () => {
    setBusy(true);
    attempt.current += 1;
    try {
      await e2eSession.set(userId, await e2eService.setUp(true));
      onDone();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-primary-50 flex items-center justify-center">
        <Smartphone className="w-7 h-7 text-primary-700" strokeWidth={1.75} />
      </div>
      <h1 className="text-2xl font-semibold text-muted-900 text-center">Link this browser</h1>
      <p className="mt-2 text-center text-sm text-muted-600">
        Your chats are end-to-end encrypted. To read them here, open Papyris on your phone (or another signed-in
        browser), go to <span className="font-medium text-muted-800">Settings → End-to-end encryption → Link a device</span>,
        and scan this code.
      </p>

      <div className="mt-6 flex flex-col items-center">
        {link && !expired ? (
          <>
            <div className="p-3 bg-white border border-muted-200 rounded-xl" aria-label="Link code QR">
              <QRCodeSVG value={link.qrText} size={200} level="M" />
            </div>
            <p className="mt-4 text-xs text-muted-500">Or type this code on the other device</p>
            <p className="mt-1 font-mono text-lg tracking-wider text-muted-900" data-testid="link-code">{formatLinkCode(link.code)}</p>
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-500">
              <span className="w-3 h-3 rounded-full border-2 border-primary-200 border-t-primary-700 animate-spin" /> Waiting for your other device…
            </p>
          </>
        ) : expired ? (
          <div className="text-center">
            <p className="text-sm text-muted-600">The code expired.</p>
            <button type="button" onClick={begin} className="mt-3 px-4 py-2 rounded-lg bg-primary-700 text-white text-sm font-medium">Show a new code</button>
          </div>
        ) : !error && (
          <span className="w-8 h-8 rounded-full border-2 border-primary-200 border-t-primary-700 animate-spin" />
        )}
        {error && (
          <div className="mt-4 w-full p-3 bg-accent-50 border border-accent-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-accent-600 flex-shrink-0" />
            <div className="text-sm text-accent-700">
              {error}{' '}
              <button type="button" onClick={begin} className="font-medium underline">Try again</button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 text-center text-sm">
        {confirmFresh ? (
          <div className="p-3 rounded-lg bg-warning-50 text-warning-800 text-left">
            <p>Starting fresh creates new keys. Your encrypted messages from before can't be read again, on any device, and the people you chat with will see that your keys changed.</p>
            <div className="mt-2 flex gap-3">
              <button type="button" onClick={startFresh} disabled={busy} className="font-medium text-accent-700 hover:underline">{busy ? 'Starting…' : 'Start fresh'}</button>
              <button type="button" onClick={() => setConfirmFresh(false)} className="text-muted-600 hover:underline">Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmFresh(true)} className="text-primary-700 hover:underline">Don't have your other device?</button>
        )}
      </div>
    </>
  );
};

export default E2EGate;
