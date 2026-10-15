// src/components/organisms/SafetySettings.tsx
// Settings → Blocked people, and (app admins only) the reports to review.

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Flag } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { Avatar } from '../atoms';
import { REPORT_REASONS, safetyService } from '../../services/safety.service';
import type { BlockedPerson, ReportOutcome, ReportReason, ReportView } from '../../services/safety.service';
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
interface Draft { note: string; outcome: ReportOutcome | null; warn: boolean; rule: ReportReason; message: string }

export const ReportsReview: React.FC<{ onOpenUser?: (id: string) => void }> = ({ onOpenUser }) => {
  const [status, setStatus] = useState<'open' | 'resolved'>('open');
  const [reports, setReports] = useState<ReportView[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const load = useCallback(() => { safetyService.reports(status).then(setReports).catch((e) => toast.error(parseApiError(e))); }, [status]);
  useEffect(() => { setReports(null); load(); }, [load]);

  const draftOf = (r: ReportView): Draft => drafts[r.id] || { note: '', outcome: null, warn: false, rule: r.reason, message: '' };
  const edit = (r: ReportView, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [r.id]: { ...draftOf(r), ...patch } }));

  const resolve = async (r: ReportView) => {
    const d = draftOf(r);
    const outcome = d.warn ? 'action_taken' : d.outcome;
    if (!d.note.trim() || !outcome) return;
    try {
      await safetyService.resolve(r.id, {
        resolution: d.note.trim(), outcome,
        ...(d.warn ? { warn: true, warning_reason: d.rule, warning_message: d.message.trim() || undefined } : {}),
      });
      toast.success(d.warn ? 'Resolved. The warning and an update to the reporter were sent.' : 'Resolved. The reporter was told the outcome.');
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
            {r.status === 'open' ? (() => {
              const d = draftOf(r);
              const ready = !!d.note.trim() && (d.warn || !!d.outcome);
              return (
                <fieldset className="pt-1 space-y-2.5">
                  <legend className="sr-only">Resolve this report</legend>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Outcome (told to the reporter)">
                    {([['action_taken', 'Action taken'], ['no_violation', 'No problem found']] as const).map(([value, label]) => {
                      const on = (d.warn ? 'action_taken' : d.outcome) === value;
                      return (
                        <button key={value} type="button" role="radio" aria-checked={on} disabled={d.warn && value === 'no_violation'}
                          onClick={() => edit(r, { outcome: value })}
                          className={`px-3 h-8 text-sm font-semibold rounded-full border ${on ? 'bg-primary-100 text-primary-700 border-transparent' : 'border-muted-200 text-muted-600'} disabled:opacity-40`}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {r.reported_user && (
                    <label className="flex items-center gap-2 text-sm text-muted-800">
                      <input type="checkbox" checked={d.warn} onChange={(e) => edit(r, { warn: e.target.checked })} />
                      Warn {nameOf(r.reported_user)} (they'll see it under Notices; it doesn't say who reported them)
                    </label>
                  )}
                  {d.warn && (
                    <div className="grid gap-2 sm:grid-cols-[220px_1fr]">
                      <select value={d.rule} onChange={(e) => edit(r, { rule: e.target.value as ReportReason })} aria-label="Rule broken"
                        className="h-9 px-2 text-sm rounded-lg border border-muted-200 bg-white">
                        {REPORT_REASONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                      </select>
                      <input value={d.message} onChange={(e) => edit(r, { message: e.target.value })} maxLength={500}
                        placeholder="Message they'll read (optional), e.g. please keep it respectful" aria-label="Warning message"
                        className="min-w-0 h-9 px-3 text-sm rounded-lg border border-muted-200" />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input value={d.note} onChange={(e) => edit(r, { note: e.target.value })}
                      placeholder="Note for admins (only admins see this)" aria-label="Note for admins"
                      className="flex-1 min-w-0 h-9 px-3 text-sm rounded-lg border border-muted-200" />
                    <button type="button" onClick={() => resolve(r)} disabled={!ready}
                      className="px-3 h-9 text-sm font-semibold text-white bg-primary-700 rounded-lg disabled:opacity-50">Resolve</button>
                  </div>
                  <p className="text-xs text-muted-500">The reporter is told only whether action was taken, never what it was.</p>
                </fieldset>
              );
            })() : (
              <p className="text-sm text-success-700">
                Resolved{r.outcome ? ` (${r.outcome === 'action_taken' ? 'action taken' : 'no problem found'})` : ''}: {r.resolution}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
