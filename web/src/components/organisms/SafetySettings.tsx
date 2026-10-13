// src/components/organisms/SafetySettings.tsx
// Settings → Blocked people, and (app admins only) the reports to review.

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Flag } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { Avatar } from '../atoms';
import { REPORT_REASONS, safetyService } from '../../services/safety.service';
import type { BlockedPerson, ReportView } from '../../services/safety.service';
import { setBlocked } from '../../redux/slices/chatSlice';
import { parseApiError } from '../../utils/apiError';

const nameOf = (p: { name?: string | null; username: string } | null) => (p ? p.name || p.username : 'Someone');

export const BlockedPeopleSettings: React.FC = () => {
  const dispatch = useDispatch();
  const [people, setPeople] = useState<BlockedPerson[] | null>(null);
  useEffect(() => { safetyService.blocked().then(setPeople).catch(() => setPeople([])); }, []);

  const unblock = async (p: BlockedPerson) => {
    try {
      await safetyService.unblock(p.id);
      dispatch(setBlocked({ userId: p.id, blocked: false }));
      setPeople((list) => (list || []).filter((x) => x.id !== p.id));
      toast.success(`Unblocked ${nameOf(p)}`);
    } catch (error) {
      toast.error(parseApiError(error));
    }
  };

  return (
    <div className="card p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-muted-900">Blocked people</h2>
      <p className="text-sm text-muted-500">They can't message you directly or add you to groups. They aren't told.</p>
      {people && people.length === 0 && <p className="mt-3 text-sm text-muted-400">You haven't blocked anyone.</p>}
      <ul className="mt-2 divide-y divide-muted-100">
        {(people || []).map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <Avatar src={p.avatar || undefined} alt={nameOf(p)} size="sm" />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-muted-900 truncate">{nameOf(p)}</span>
              <span className="block text-xs text-muted-500">@{p.username}</span>
            </span>
            <button type="button" onClick={() => unblock(p)} className="px-3 py-1.5 text-sm font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg">
              Unblock
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const reasonLabel = (r: string) => REPORT_REASONS.find((x) => x.value === r)?.label || r;

/** Report review (admin console). onOpenUser opens the reported person's account. */
export const ReportsReview: React.FC<{ onOpenUser?: (id: string) => void }> = ({ onOpenUser }) => {
  const [status, setStatus] = useState<'open' | 'resolved'>('open');
  const [reports, setReports] = useState<ReportView[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const load = useCallback(() => { safetyService.reports(status).then(setReports).catch((e) => toast.error(parseApiError(e))); }, [status]);
  useEffect(() => { setReports(null); load(); }, [load]);

  const resolve = async (r: ReportView) => {
    const resolution = (drafts[r.id] || '').trim();
    if (!resolution) return;
    try {
      await safetyService.resolve(r.id, resolution);
      load();
    } catch (error) {
      toast.error(parseApiError(error));
    }
  };

  return (
    <div className="card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-muted-900 flex items-center gap-2"><Flag className="w-5 h-5 text-accent-600" /> Reports to review</h2>
        <div className="inline-flex p-[3px] bg-[#f1f0f5] rounded-[11px]" role="tablist">
          {(['open', 'resolved'] as const).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-[9px] ${status === s ? 'bg-white text-primary-700 shadow-sm' : 'text-muted-500'}`}>
              {s === 'open' ? 'Open' : 'Resolved'}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted-500">Only app admins see this. Message text appears only when the reporter chose to share it.</p>
      {reports && reports.length === 0 && <p className="mt-3 text-sm text-muted-400">Nothing {status === 'open' ? 'to review' : 'resolved yet'}.</p>}
      <ul className="mt-3 space-y-3">
        {(reports || []).map((r) => (
          <li key={r.id} className="p-4 rounded-xl border border-muted-200 space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold text-muted-900">{reasonLabel(r.reason)}</span>
              <span className="text-xs text-muted-500">{new Date(r.created_at).toLocaleString()}</span>
            </div>
            <p className="text-sm text-muted-700">
              <b>{nameOf(r.reporter)}</b> reported{' '}
              {r.reported_user ? <>
                <b>{nameOf(r.reported_user)}</b> (@{r.reported_user.username}, reported {r.times_reported}×)
                {onOpenUser && <button type="button" onClick={() => onOpenUser(r.reported_user!.id)}
                  className="ml-1.5 text-xs font-semibold text-primary-700 hover:underline">Open account</button>}
              </> : 'a chat'}
              {r.conversation && <> in {r.conversation.kind === 'group' ? `the group "${r.conversation.title}"` : 'a direct chat'}</>}
              {r.message_id && ' about a message'}.
            </p>
            {r.details && <p className="text-sm text-muted-600">“{r.details}”</p>}
            {r.evidence && <p className="text-sm p-2.5 rounded-lg bg-muted-50 text-muted-800 whitespace-pre-wrap">{r.evidence}</p>}
            {r.status === 'open' ? (
              <div className="flex gap-2">
                <input value={drafts[r.id] || ''} onChange={(e) => setDrafts({ ...drafts, [r.id]: e.target.value })}
                  placeholder="What you did (e.g. warned the user)" aria-label="Resolution"
                  className="flex-1 min-w-0 h-9 px-3 text-sm rounded-lg border border-muted-200" />
                <button type="button" onClick={() => resolve(r)} disabled={!(drafts[r.id] || '').trim()}
                  className="px-3 h-9 text-sm font-semibold text-white bg-primary-700 rounded-lg disabled:opacity-50">Resolve</button>
              </div>
            ) : (
              <p className="text-sm text-success-700">Resolved: {r.resolution}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
