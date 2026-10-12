// src/components/expenses/ExpensesHome.tsx
// Expenses home: where you stand overall, who you're even with, and the latest expenses and payments
// from every chat in one list.

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRightLeft, ChevronRight, PenLine } from 'lucide-react';
import { Avatar } from '../atoms';
import { expenseService } from '../../services/expense.service';
import type { ActivityItem, BalanceUser, ExpensesOverview } from '../../services/expense.service';
import CategoryIcon from './CategoryIcon';
import { Approx, displayName, Money, useDisplayCurrency, useExpenseChanges } from './shared';

type Activity = { items: ActivityItem[]; users: Record<string, BalanceUser>; chats: Record<string, { name: string; is_group: boolean }> };

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400e3);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
};

const ExpensesHome: React.FC<{
  overview: ExpensesOverview | null;
  currentUserId: string;
  onOpenChat: (id: string) => void;
  onOpenExpense: (id: string, edit?: boolean) => void;
  activityOnly?: boolean; // phones: the list page already shows the totals
}> = ({ overview, currentUserId, onOpenChat, onOpenExpense, activityOnly }) => {
  const [activity, setActivity] = useState<Activity | null>(null);
  const { target, convert } = useDisplayCurrency();
  const load = useCallback(() => { expenseService.recentActivity(40).then(setActivity).catch(() => undefined); }, []);
  useEffect(() => { load(); }, [load]);
  useExpenseChanges(undefined, load);

  const name = (id: string) => (id === currentUserId ? 'You' : displayName(activity?.users[id]));

  // Headline numbers: in the chosen display currency when set (≈), otherwise the main currency
  const currencies = overview?.currencies || [];
  const combined = target && currencies.length
    ? currencies.reduce<{ owed: number; owe: number } | null>((sum, c) => {
      const owed = convert(c.owed_minor, c.currency);
      const owe = convert(c.owe_minor, c.currency);
      return sum && owed !== null && owe !== null ? { owed: sum.owed + owed, owe: sum.owe + owe } : null;
    }, { owed: 0, owe: 0 })
    : null;
  const tiles = combined && target
    ? { currency: target, owed: combined.owed, owe: combined.owe, approx: currencies.some((c) => c.currency !== target) }
    : currencies[0] ? { currency: currencies[0].currency, owed: currencies[0].owed_minor, owe: currencies[0].owe_minor, approx: false } : null;

  let lastDay = '';
  const activitySection = (
      <section className="card" aria-label="Recent activity">
        <div className="px-5 pt-5 pb-2">
          <h3 className="font-display font-semibold text-muted-900">Recent activity</h3>
          <p className="text-xs text-muted-500">Expenses and payments from all your chats</p>
        </div>
        {!activity ? (
          <div className="py-10 flex justify-center"><div className="w-7 h-7 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" /></div>
        ) : activity.items.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-muted-500">Nothing yet. Add an expense in any chat and it shows up here.</p>
        ) : (
          <ul className="pb-2">
            {activity.items.map((it) => {
              const day = dayLabel(it.at);
              const header = day !== lastDay ? (lastDay = day) : null;
              const chat = activity.chats[it.conversation_id];
              const chatButton = (
                <button type="button" onClick={() => onOpenChat(it.conversation_id)} className="font-semibold text-primary-700 hover:underline">
                  {chat?.name || 'Chat'}
                </button>
              );
              return (
                <React.Fragment key={`${it.kind}-${it.id}`}>
                  {header && <li className="px-5 pt-3 pb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-400">{header}</li>}
                  {it.kind === 'settlement' ? (
                    <li className="flex items-center gap-3 px-5 py-2.5">
                      <span className="w-9 h-9 flex-shrink-0 rounded-[11px] grid place-items-center bg-success-50 text-success-700"><ArrowRightLeft size={16} /></span>
                      <span className="flex-1 min-w-0 text-sm">
                        <span className="block font-medium text-muted-900 truncate">{name(it.from_user)} paid {it.to_user === currentUserId ? 'you' : name(it.to_user)}</span>
                        <span className="block text-xs text-muted-500 truncate">Payment · {chatButton}</span>
                      </span>
                      <span className="text-right">
                        <Money minor={it.amount_minor} currency={it.currency} className="block text-sm font-semibold" />
                        <Approx minor={it.amount_minor} currency={it.currency} />
                      </span>
                    </li>
                  ) : (() => {
                    const net = (it.payers.find((p) => p.user_id === currentUserId)?.amount_minor || 0) - (it.shares.find((s) => s.user_id === currentUserId)?.amount_minor || 0);
                    const payer = it.payers.length > 1 ? `${it.payers.length} people` : name(it.payers[0]?.user_id || '');
                    return (
                      <li className="group flex items-center gap-1 px-3">
                        <button type="button" onClick={() => onOpenExpense(it.id)} className="flex-1 min-w-0 flex items-center gap-3 px-2 py-2.5 rounded-xl text-left hover:bg-muted-50">
                          <CategoryIcon category={it.category} size="sm" />
                          <span className="flex-1 min-w-0 text-sm">
                            <span className="block font-medium text-muted-900 truncate">{it.description}</span>
                            <span className="block text-xs text-muted-500 truncate">
                              {payer} paid <Money minor={it.total_minor} currency={it.currency} /> · {chat?.name || 'Chat'}
                            </span>
                          </span>
                          <span className="flex-shrink-0 text-right">
                            <span className={`block text-sm font-semibold tabular-nums whitespace-nowrap ${net > 0 ? 'text-success-700' : net < 0 ? 'text-accent-500' : 'text-muted-400'}`}>
                              {net === 0 ? <span className="text-xs font-medium">Not involved</span> : <>
                                <span className="hidden sm:inline">{net > 0 ? 'you lent ' : 'you owe '}</span>
                                <span className="sm:hidden">{net > 0 ? '+' : '−'}</span>
                                <Money minor={Math.abs(net)} currency={it.currency} />
                              </>}
                            </span>
                            {net !== 0 && <Approx minor={Math.abs(net)} currency={it.currency} />}
                          </span>
                        </button>
                        {it.can_edit && (
                          <button type="button" onClick={() => onOpenExpense(it.id, true)} title="Edit" aria-label={`Edit ${it.description}`}
                            className="flex-shrink-0 p-2 rounded-lg text-muted-400 hover:text-primary-700 hover:bg-primary-50 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100">
                            <PenLine size={15} />
                          </button>
                        )}
                      </li>
                    );
                  })()}
                </React.Fragment>
              );
            })}
          </ul>
        )}
      </section>
  );
  if (activityOnly) return activitySection;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-7 space-y-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary-500">Overview</p>
        <h2 className="font-display text-xl font-semibold text-muted-900">All your expenses</h2>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3" aria-label="Totals">
        {[
          { label: 'Owed to you', value: tiles?.owed ?? 0, tone: 'text-success-700' },
          { label: 'You owe', value: tiles?.owe ?? 0, tone: 'text-accent-500' },
          { label: 'Overall', value: (tiles?.owed ?? 0) - (tiles?.owe ?? 0), tone: 'text-muted-900' },
        ].map((t) => (
          <div key={t.label} className="card p-4">
            <p className="text-xs font-semibold text-muted-500">{t.label}</p>
            <p className={`mt-1 font-display text-2xl font-bold tabular-nums ${t.tone}`}>
              {tiles ? <>{tiles.approx && '≈ '}{t.value < 0 ? '−' : ''}<Money minor={Math.abs(t.value)} currency={tiles.currency} /></> : '—'}
            </p>
            {currencies.length > 1 && !combined && t.label === 'Overall' && (
              <p className="text-[11px] text-muted-400">Plus {currencies.length - 1} other currenc{currencies.length === 2 ? 'y' : 'ies'}. Pick one in Settings to see it all together.</p>
            )}
          </div>
        ))}
      </section>

      {!!overview?.people.length && (
        <section className="card" aria-label="People">
          <div className="px-5 pt-5 pb-2">
            <h3 className="font-display font-semibold text-muted-900">People</h3>
            <p className="text-xs text-muted-500">Across every chat you share</p>
          </div>
          <ul className="divide-y divide-muted-100">
            {overview.people.map((p) => {
              const u = overview.users[p.user_id];
              return (
                <li key={`${p.user_id}-${p.currency}`} className="flex items-center gap-3 px-5 py-3">
                  <Avatar src={u?.avatar || undefined} alt={displayName(u)} size="md" />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-muted-900 truncate">{displayName(u)}</span>
                    <span className="block text-xs text-muted-500 truncate">
                      {p.chats.length === 1 ? (p.chats[0].is_group ? p.chats[0].title || 'A group' : 'Direct chat') : `${p.chats.length} chats`}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className={`block text-sm font-bold tabular-nums ${p.net_minor > 0 ? 'text-success-700' : 'text-accent-500'}`}>
                      {p.net_minor > 0 ? 'owes you ' : 'you owe '}<Money minor={Math.abs(p.net_minor)} currency={p.currency} />
                    </span>
                    <Approx minor={Math.abs(p.net_minor)} currency={p.currency} />
                  </span>
                  <button type="button" onClick={() => onOpenChat(p.chats[0].conversation_id)} title="Open their expenses" aria-label={`Open expenses with ${displayName(u)}`}
                    className="p-1.5 rounded-lg text-muted-400 hover:text-primary-700 hover:bg-primary-50">
                    <ChevronRight size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {activitySection}
    </div>
  );
};

export default ExpensesHome;
