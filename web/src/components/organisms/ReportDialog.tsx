// src/components/organisms/ReportDialog.tsx
// Report a person, a message or a group to the ShareEven team, and optionally block the person.
// Encrypted messages can't be read by the server, so a reported message's text reaches the team
// only if the reporter chooses to share it here.

import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { Flag } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { REPORT_REASONS, safetyService } from '../../services/safety.service';
import type { ReportReason } from '../../services/safety.service';
import { setBlocked } from '../../redux/slices/chatSlice';
import { parseApiError } from '../../utils/apiError';

export interface ReportTarget {
  title: string; // "Report Bob", "Report this message", "Report Flat 12B"
  userId?: string; // the person being reported (offered "Also block")
  userName?: string;
  conversationId?: string;
  messageId?: string;
  messageText?: string; // shared only if the reporter ticks the box
}

const ReportDialog: React.FC<{ target: ReportTarget; onClose: () => void }> = ({ target, onClose }) => {
  const dispatch = useDispatch();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [shareText, setShareText] = useState(!!target.messageText);
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setBusy(true);
    try {
      const result = await safetyService.report({
        user_id: target.userId, conversation_id: target.conversationId, message_id: target.messageId,
        reason, details: details.trim() || undefined,
        evidence: shareText && target.messageText ? target.messageText : undefined,
        block: alsoBlock && !!target.userId,
      });
      if (result.blocked && target.userId) dispatch(setBlocked({ userId: target.userId, blocked: true }));
      toast.success(result.blocked ? `Reported and blocked ${target.userName || 'them'}` : "Thanks, we'll look into it");
      onClose();
    } catch (error) {
      toast.error(parseApiError(error));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#18121f]/60 backdrop-blur-[3px] p-4" onClick={onClose}>
      <form role="dialog" aria-label={target.title} onSubmit={submit} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-[20px] shadow-elevated p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-accent-50 text-accent-600 grid place-items-center"><Flag className="w-5 h-5" /></span>
          <div>
            <h2 className="font-display text-lg font-semibold text-muted-900">{target.title}</h2>
            <p className="text-xs text-muted-500">The ShareEven team reviews reports. {target.userName ? `${target.userName} isn't told.` : ''}</p>
          </div>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="mb-1.5 text-xs font-bold text-muted-500">What's wrong?</legend>
          {REPORT_REASONS.map((r) => (
            <label key={r.value} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer text-sm ${
              reason === r.value ? 'border-accent-300 bg-accent-50 text-muted-900' : 'border-muted-200 text-muted-700 hover:bg-muted-50'
            }`}>
              <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="accent-accent-600" />
              {r.label}
            </label>
          ))}
        </fieldset>

        <label className="block">
          <span className="block mb-1.5 text-xs font-bold text-muted-500">Anything else? (optional)</span>
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={1000}
            className="w-full px-3 py-2 rounded-xl border border-muted-200 outline-none focus:border-accent-400 focus:ring-4 focus:ring-accent-50 text-sm" />
        </label>

        {target.messageText && (
          <label className="flex items-start gap-2.5 text-sm text-muted-700">
            <input type="checkbox" checked={shareText} onChange={(e) => setShareText(e.target.checked)} className="mt-1 accent-accent-600" />
            <span>
              Share this message's text with the ShareEven team
              <span className="block text-xs text-muted-500">Messages are end-to-end encrypted, so the team can only see it if you share it.</span>
            </span>
          </label>
        )}
        {target.userId && (
          <label className="flex items-start gap-2.5 text-sm text-muted-700">
            <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} className="mt-1 accent-accent-600" />
            <span>Also block {target.userName || 'this person'}<span className="block text-xs text-muted-500">They can't message you directly or add you to groups.</span></span>
          </label>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-[11px] text-sm font-semibold text-muted-600 hover:bg-muted-100">Cancel</button>
          <button type="submit" disabled={!reason || busy}
            className="h-10 px-4 rounded-[11px] text-sm font-bold text-white bg-accent-600 hover:bg-accent-700 disabled:opacity-50">
            {busy ? 'Sending…' : 'Send report'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReportDialog;
