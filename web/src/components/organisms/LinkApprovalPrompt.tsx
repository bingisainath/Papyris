// src/components/organisms/LinkApprovalPrompt.tsx
// "Is this you?": when a new phone or browser signs in to this account and asks to be linked, every
// linked device shows this. Picking the number shown on the new device approves it in one tap
// (crypto/v2/link.ts linkNumber); a wrong number or "Not me" turns it down.

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { MonitorSmartphone } from 'lucide-react';
import { pendingApprovals } from '../../crypto/v2-platform/link';
import type { LinkApproval } from '../../crypto/v2-platform/link';
import { wsService } from '../../services/websocket.service';
import { parseApiError } from '../../utils/apiError';

const EVENTS = ['e2e_link_request', 'e2e_link_denied', 'e2e_link_granted'];

const LinkApprovalPrompt: React.FC<{ userId: string }> = ({ userId }) => {
  const [waiting, setWaiting] = useState<LinkApproval[]>([]);
  const [sendHistory, setSendHistory] = useState(true);
  const [busy, setBusy] = useState(false);
  // "Not now": closed on this device only (to approve with the code instead, or decide elsewhere)
  const [closed, setClosed] = useState<Set<string>>(() => new Set());

  const refresh = useCallback(() => {
    pendingApprovals(userId).then(setWaiting).catch(() => undefined);
  }, [userId]);

  useEffect(() => {
    refresh();
    const onEvent = () => refresh();
    EVENTS.forEach((e) => wsService.on(e, onEvent));
    // Missed the live event (tab asleep, offline): check when the tab comes back
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      EVENTS.forEach((e) => wsService.off(e, onEvent));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const current = waiting.find((w) => !closed.has(w.id));
  if (!current) return null;

  const run = async (action: () => Promise<boolean | void>) => {
    setBusy(true);
    try {
      const outcome = await action();
      if (outcome === true) toast.success(`${current.name} is linked`);
      else if (outcome === false) toast.error(`That wasn't the number on ${current.name}, so it was turned down. Try again on the new device if it was you.`, { autoClose: 8000 });
      else toast.info(`${current.name} was turned down`);
    } catch (error) {
      toast.error(parseApiError(error));
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#18121f]/60 backdrop-blur-[3px] p-4">
      <div role="alertdialog" aria-modal="true" aria-labelledby="link-approval-title" aria-describedby="link-approval-text"
        className="w-full max-w-sm bg-white rounded-[20px] shadow-elevated p-6 text-center">
        <span className="mx-auto w-12 h-12 rounded-2xl bg-primary-50 text-primary-700 grid place-items-center">
          <MonitorSmartphone className="w-6 h-6" />
        </span>
        <h2 id="link-approval-title" className="mt-4 font-display text-xl font-semibold text-muted-900">Is this you?</h2>
        <p id="link-approval-text" className="mt-2 text-sm text-muted-600">
          <b className="text-muted-900">{current.name}</b> wants to read your encrypted chats. Only continue if you're signing in on it right now.
        </p>
        <p className="mt-5 text-xs font-bold uppercase tracking-wide text-muted-500">Tap the number shown on {current.name}</p>
        <div className="mt-3 grid grid-cols-3 gap-3" role="group" aria-label="Number choices">
          {current.choices.map((n) => (
            <button key={n} type="button" disabled={busy} onClick={() => run(() => current.answer(n, sendHistory))}
              className="h-16 rounded-2xl border-2 border-primary-100 bg-primary-50 font-display text-3xl font-bold text-primary-700 tabular-nums hover:border-primary-400 hover:bg-primary-100 disabled:opacity-50">
              {n}
            </button>
          ))}
        </div>
        <label className="mt-5 flex items-start gap-2 text-left text-sm text-muted-700">
          <input type="checkbox" checked={sendHistory} onChange={(e) => setSendHistory(e.target.checked)} className="mt-0.5 accent-primary-700" />
          <span>Send my message history<span className="block text-xs text-muted-500">Encrypted so only that device can open it.</span></span>
        </label>
        <button type="button" disabled={busy} onClick={() => run(async () => { await current.deny(); })}
          className="mt-5 w-full h-11 rounded-xl text-sm font-bold text-accent-700 bg-accent-50 hover:bg-accent-100 disabled:opacity-50">
          {busy ? 'Working…' : 'Not me'}
        </button>
        <button type="button" disabled={busy} onClick={() => setClosed((c) => new Set(c).add(current.id))}
          className="mt-2 w-full h-10 rounded-xl text-sm font-medium text-muted-600 hover:bg-muted-100 disabled:opacity-50">
          Not now
        </button>
      </div>
    </div>
  );
};

export default LinkApprovalPrompt;
