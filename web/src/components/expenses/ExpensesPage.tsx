// src/components/expenses/ExpensesPage.tsx
// The Expenses tab: pick a chat, see balances, settle up, browse and add expenses.

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Avatar } from '../atoms';
import { expenseService } from '../../services/expense.service';
import type { ExpensesOverview } from '../../services/expense.service';
import { displayName, Money, useExpenseChanges } from './shared';
import AddExpenseSheet from './AddExpenseSheet';
import ChatExpenses from './ChatExpenses';
import ExpenseDetail from './ExpenseDetail';

interface ChatSummary {
  id: string;
  name: string;
  avatar?: string;
  isGroup?: boolean;
}

interface Props {
  conversations: ChatSummary[];
  currentUserId: string;
}

const ExpensesPage: React.FC<Props> = ({ conversations, currentUserId }) => {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('chat') || undefined;
  const selected = conversations.find((c) => c.id === selectedId);
  // Groups by default; a direct chat shows up once it has expenses (or with "Show all chats")
  const [withExpenses, setWithExpenses] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    expenseService.conversationsWithExpenses().then((ids) => setWithExpenses(new Set(ids))).catch(() => undefined);
  }, [conversations]);
  const listed = useMemo(
    () => conversations.filter((c) => showAll || c.isGroup || withExpenses.has(c.id) || c.id === selectedId),
    [conversations, showAll, withExpenses, selectedId],
  );
  const hidden = conversations.length - listed.length;
  const [openExpense, setOpenExpense] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Desktop: open the first chat so the page isn't empty
  useEffect(() => {
    if (!selectedId && listed.length && window.matchMedia('(min-width: 768px)').matches) {
      setParams({ chat: listed[0].id }, { replace: true });
    }
  }, [selectedId, listed, setParams]);

  return (
    <div className="flex h-full">
      <aside className={`w-full md:w-80 flex-shrink-0 border-r border-muted-200 bg-white/80 overflow-y-auto ${selected ? 'hidden md:block' : ''}`}>
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold text-muted-900">Expenses</h1>
        </div>
        <Overview conversations={conversations} onOpenChat={(id) => setParams({ chat: id })} />
        <ul>
          {listed.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setParams({ chat: c.id })}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted-50 ${c.id === selectedId ? 'bg-primary-50' : ''}`}
              >
                <Avatar src={c.avatar} alt={c.name} size="md" />
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-muted-900 truncate">{c.name}</span>
                  <span className="block text-xs text-muted-500">{c.isGroup ? 'Group' : 'Direct message'}</span>
                </span>
              </button>
            </li>
          ))}
          {listed.length === 0 && <li className="px-4 py-6 text-sm text-muted-500">Create a group to share expenses.</li>}
          {(hidden > 0 || showAll) && (
            <li className="px-4 py-3">
              <button type="button" onClick={() => setShowAll((v) => !v)} className="text-sm text-primary-700 hover:underline">
                {showAll ? 'Show groups only' : `Show all chats (${hidden} direct)`}
              </button>
            </li>
          )}
        </ul>
      </aside>

      <main className={`flex-1 min-w-0 overflow-y-auto ${selected ? '' : 'hidden md:block'}`}>
        {selected ? (
          <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6">
            <div className="flex items-center gap-3 mb-5">
              <button type="button" onClick={() => setParams({})} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-muted-100" aria-label="Back">
                <svg className="w-5 h-5 text-muted-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <Avatar src={selected.avatar} alt={selected.name} size="lg" />
              <h2 className="text-xl font-semibold text-muted-900 truncate">{selected.name}</h2>
            </div>
            <ChatExpenses
              key={selected.id}
              conversationId={selected.id}
              currentUserId={currentUserId}
              onOpenExpense={setOpenExpense}
              onAddExpense={() => setAdding(true)}
            />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-400">Choose a chat</div>
        )}
      </main>

      {openExpense && (
        <ExpenseDetail expenseId={openExpense} currentUserId={currentUserId} onClose={() => setOpenExpense(null)} />
      )}
      {adding && selected && (
        <AddExpenseSheet conversationId={selected.id} currentUserId={currentUserId} onClose={() => setAdding(false)} />
      )}
    </div>
  );
};

/** Your money across every chat: totals per currency, then one line per person (tap to see the chats). */
const Overview: React.FC<{ conversations: ChatSummary[]; onOpenChat: (id: string) => void }> = ({ conversations, onOpenChat }) => {
  const [data, setData] = useState<ExpensesOverview | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = React.useCallback(() => { expenseService.overview().then(setData).catch(() => undefined); }, []);
  useEffect(() => { load(); }, [load]);
  useExpenseChanges(undefined, load);
  if (!data) return null;
  const chatName = (id: string, title: string | null) => title || conversations.find((c) => c.id === id)?.name || 'Direct chat';

  return (
    <section className="mx-4 mb-4 p-4 rounded-2xl bg-primary-50/60 border border-primary-100" aria-label="Overall">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary-800">Overall</p>
      {data.currencies.length === 0 ? (
        <p className="mt-1 text-sm text-muted-600">You're all settled up.</p>
      ) : data.currencies.map((c) => (
        <div key={c.currency} className="mt-2">
          <p className={`text-lg font-bold ${c.net_minor > 0 ? 'text-success-700' : c.net_minor < 0 ? 'text-accent-600' : 'text-muted-700'}`}>
            {c.net_minor > 0 ? "You're owed " : c.net_minor < 0 ? 'You owe ' : 'Settled · '}<Money minor={Math.abs(c.net_minor)} currency={c.currency} />
          </p>
          <p className="text-xs text-muted-600">
            Owed to you <Money minor={c.owed_minor} currency={c.currency} /> · you owe <Money minor={c.owe_minor} currency={c.currency} />
          </p>
        </div>
      ))}
      {data.people.length > 0 && (
        <ul className="mt-3 space-y-1">
          {data.people.map((p) => {
            const key = `${p.user_id}-${p.currency}`;
            return (
              <li key={key}>
                <button type="button" onClick={() => setOpen(open === key ? null : key)} aria-expanded={open === key}
                  className="w-full flex items-center gap-2 py-1.5 text-left text-sm">
                  <Avatar src={data.users[p.user_id]?.avatar || undefined} alt={displayName(data.users[p.user_id])} size="xs" />
                  <span className="flex-1 min-w-0 truncate text-muted-800">{displayName(data.users[p.user_id])}</span>
                  <span className={`font-semibold ${p.net_minor > 0 ? 'text-success-700' : 'text-accent-600'}`}>
                    {p.net_minor > 0 ? 'owes you ' : 'you owe '}<Money minor={Math.abs(p.net_minor)} currency={p.currency} />
                  </span>
                </button>
                {open === key && (
                  <ul className="ml-8 mb-1 space-y-0.5">
                    {p.chats.map((ch) => (
                      <li key={ch.conversation_id}>
                        <button type="button" onClick={() => onOpenChat(ch.conversation_id)} className="w-full flex justify-between text-xs text-muted-600 hover:text-primary-700">
                          <span className="truncate">{ch.is_group ? chatName(ch.conversation_id, ch.title) : 'Direct chat'}</span>
                          <span>{ch.amount_minor > 0 ? '+' : '−'}<Money minor={Math.abs(ch.amount_minor)} currency={p.currency} /></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default ExpensesPage;
