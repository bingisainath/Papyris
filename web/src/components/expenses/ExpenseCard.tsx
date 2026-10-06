// src/components/expenses/ExpenseCard.tsx
// The card shown in the chat when someone adds, edits or deletes an expense.

import React, { useCallback, useEffect, useState } from 'react';
import { expenseService } from '../../services/expense.service';
import type { Expense } from '../../services/expense.service';
import { EXPENSE_CHANGED_EVENT } from '../../utils/events';
import CategoryIcon from './CategoryIcon';
import { Money } from './shared';

// One request per expense even when several cards (added, edited...) show it
const cache = new Map<string, Promise<Expense>>();
const fetchExpense = (id: string, fresh = false) => {
  if (fresh || !cache.has(id)) cache.set(id, expenseService.get(id).catch((e) => { cache.delete(id); throw e; }));
  return cache.get(id)!;
};

interface Props {
  expenseId: string;
  text: string;
  timestamp: string;
  currentUserId: string;
  onOpen: (expenseId: string) => void;
}

const ExpenseCard: React.FC<Props> = ({ expenseId, text, timestamp, currentUserId, onOpen }) => {
  const [expense, setExpense] = useState<Expense | null>(null);

  const load = useCallback((fresh = false) => {
    fetchExpense(expenseId, fresh).then(setExpense).catch(() => setExpense(null));
  }, [expenseId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onChange = (e: Event) => {
      if ((e as CustomEvent).detail?.expenseId === expenseId) load(true);
    };
    window.addEventListener(EXPENSE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(EXPENSE_CHANGED_EVENT, onChange);
  }, [expenseId, load]);

  const myShare = expense?.shares.find((s) => s.user_id === currentUserId)?.amount_minor || 0;
  const myPaid = expense?.payers.find((p) => p.user_id === currentUserId)?.amount_minor || 0;
  const net = myPaid - myShare;

  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={() => onOpen(expenseId)}
        className="w-full max-w-xs text-left p-3 rounded-2xl border border-primary-100 bg-white shadow-sm hover:shadow-card transition-shadow"
      >
        <p className="text-xs text-muted-500 mb-1.5">{text}</p>
        {expense ? (
          <div className={`flex items-center gap-3 ${expense.deleted ? 'opacity-50' : ''}`}>
            <CategoryIcon category={expense.category} />
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-muted-900 truncate ${expense.deleted ? 'line-through' : ''}`}>{expense.description}</p>
              <p className={`text-xs ${net > 0 ? 'text-success-700' : net < 0 ? 'text-accent-600' : 'text-muted-500'}`}>
                {expense.deleted ? 'Deleted'
                  : net > 0 ? <>You get back <Money minor={net} currency={expense.currency} /></>
                  : net < 0 ? <>You owe <Money minor={-net} currency={expense.currency} /></>
                  : 'Not involved'}
              </p>
            </div>
            <Money minor={expense.total_minor} currency={expense.currency} className="font-bold text-muted-900" />
          </div>
        ) : (
          <div className="h-10" />
        )}
        <p className="text-[10px] text-muted-400 text-right mt-1">
          {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </button>
    </div>
  );
};

export default ExpenseCard;
