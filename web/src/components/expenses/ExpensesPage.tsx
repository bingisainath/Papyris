// src/components/expenses/ExpensesPage.tsx
// The Expenses tab: pick a chat, see balances, settle up, browse and add expenses.

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Avatar } from '../atoms';
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
  const [openExpense, setOpenExpense] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Desktop: open the first chat so the page isn't empty
  useEffect(() => {
    if (!selectedId && conversations.length && window.matchMedia('(min-width: 768px)').matches) {
      setParams({ chat: conversations[0].id }, { replace: true });
    }
  }, [selectedId, conversations, setParams]);

  return (
    <div className="flex h-full">
      <aside className={`w-full md:w-80 flex-shrink-0 border-r border-muted-200 bg-white/80 overflow-y-auto ${selected ? 'hidden md:block' : ''}`}>
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold text-muted-900">Expenses</h1>
          <p className="text-sm text-muted-500">Split bills in any chat. Scan a receipt or add it by hand.</p>
        </div>
        <ul>
          {conversations.map((c) => (
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
          {conversations.length === 0 && <li className="px-4 py-6 text-sm text-muted-500">Start a chat to share expenses.</li>}
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

export default ExpensesPage;
