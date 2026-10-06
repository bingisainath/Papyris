// src/components/expenses/ChatExpenses.tsx
// Money in one chat: who owes whom (per currency), settle up, and the list of expenses.

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { expenseService } from '../../services/expense.service';
import type { Balances, Expense } from '../../services/expense.service';
import { parseApiError } from '../../utils/apiError';
import { toMajorString } from '../../utils/money';
import { CheckCircle2, Lock, ScrollText } from 'lucide-react';
import { Avatar } from '../atoms';
import CategoryIcon from './CategoryIcon';
import { displayName, Money, MoneyInput, Sheet, useExpenseChanges } from './shared';

interface Props {
  conversationId: string;
  currentUserId: string;
  onOpenExpense: (expenseId: string) => void;
  onAddExpense: () => void;
  compact?: boolean; // inside the chat info panel
}

type SettleDraft = { from: string; to: string; currency: string; amount: string };

const ChatExpenses: React.FC<Props> = ({ conversationId, currentUserId, onOpenExpense, onAddExpense, compact }) => {
  const [balances, setBalances] = useState<Balances | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [settle, setSettle] = useState<SettleDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, list] = await Promise.all([
        expenseService.balances(conversationId),
        expenseService.list(conversationId, showDeleted),
      ]);
      setBalances(b);
      setExpenses(list);
    } catch (error) {
      toast.error(parseApiError(error));
    }
  }, [conversationId, showDeleted]);

  useEffect(() => { load(); }, [load]);
  useExpenseChanges(conversationId, load);

  const name = (id: string) => (id === currentUserId ? 'You' : displayName(balances?.users[id]));

  const recordPayment = async () => {
    if (!settle) return;
    setSaving(true);
    try {
      await expenseService.settle(conversationId, {
        from_user: settle.from, to_user: settle.to, currency: settle.currency, amount: settle.amount,
      });
      toast.success('Payment recorded');
      setSettle(null);
      load();
    } catch (error) {
      toast.error(parseApiError(error));
    } finally {
      setSaving(false);
    }
  };

  if (!balances) {
    return <div className="py-10 flex justify-center"><div className="w-8 h-8 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Balances */}
      <section className="space-y-3">
        {balances.currencies.length === 0 ? (
          <div className="flex items-center justify-center gap-2 p-4 rounded-xl bg-success-50 text-success-800 text-sm">
            <CheckCircle2 className="w-4 h-4" aria-hidden /> All settled up
          </div>
        ) : balances.currencies.map((c) => (
          <div key={c.currency} className="p-4 rounded-xl border border-muted-200 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-500">{c.currency}</span>
              <span className={`font-semibold ${c.my_net_minor > 0 ? 'text-success-700' : c.my_net_minor < 0 ? 'text-accent-600' : 'text-muted-500'}`}>
                {c.my_net_minor > 0 ? 'You are owed ' : c.my_net_minor < 0 ? 'You owe ' : 'You’re settled'}
                {c.my_net_minor !== 0 && <Money minor={Math.abs(c.my_net_minor)} currency={c.currency} />}
              </span>
            </div>
            {c.debts.map((d) => {
              const mine = d.from_user === currentUserId || d.to_user === currentUserId;
              return (
                <div key={`${d.from_user}-${d.to_user}`} className="flex items-center gap-2 text-sm">
                  <Avatar src={balances.users[d.from_user]?.avatar} alt={name(d.from_user)} size="xs" />
                  <span className={`flex-1 min-w-0 truncate ${mine ? 'font-medium text-muted-900' : 'text-muted-600'}`}>
                    {name(d.from_user)} {d.from_user === currentUserId ? 'owe' : 'owes'} {d.to_user === currentUserId ? 'you' : name(d.to_user)}
                  </span>
                  <Money minor={d.amount_minor} currency={c.currency} className="font-medium" />
                  {mine && (
                    <button
                      type="button"
                      onClick={() => setSettle({ from: d.from_user, to: d.to_user, currency: c.currency, amount: toMajorString(d.amount_minor, c.currency) })}
                      className="px-2 py-1 text-xs rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100"
                    >
                      Settle
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {!compact && (
          <p className="text-xs text-muted-400">
            {balances.simplified ? 'Debts are simplified to the fewest payments.' : 'Showing who owes whom directly.'} Change this in the chat’s info.
          </p>
        )}
      </section>

      {/* Expenses */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-muted-900">Expenses</h3>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-xs text-muted-500">
              <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} /> Deleted
            </label>
            <button type="button" onClick={onAddExpense} className="px-3 py-1.5 text-sm rounded-lg bg-primary-600 text-white font-medium">+ Add</button>
          </div>
        </div>
        {expenses.length === 0 ? (
          <p className="text-sm text-muted-500 py-4 text-center">No expenses yet.</p>
        ) : (
          <ul className="divide-y divide-muted-100">
            {(compact ? expenses.slice(0, 5) : expenses).map((e) => {
              const net = (e.payers.find((p) => p.user_id === currentUserId)?.amount_minor || 0)
                - (e.shares.find((s) => s.user_id === currentUserId)?.amount_minor || 0);
              const payer = e.payers.length > 1 ? `${e.payers.length} people` : name(e.payers[0]?.user_id || '');
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => onOpenExpense(e.id)} className={`w-full flex items-center gap-3 py-2.5 text-left ${e.deleted ? 'opacity-50' : ''}`}>
                    <CategoryIcon category={e.category} size="sm" />
                    <span className="flex-1 min-w-0">
                      <span className={`block text-sm font-medium text-muted-900 truncate ${e.deleted ? 'line-through' : ''}`}>
                        {e.description}
                        {e.locked && <Lock className="inline w-3.5 h-3.5 ml-1 text-muted-400" aria-label="Locked" />}
                        {e.source === 'receipt' && <ScrollText className="inline w-3.5 h-3.5 ml-1 text-primary-500" aria-label="From a receipt" />}
                      </span>
                      <span className="block text-xs text-muted-500">
                        {payer} paid <Money minor={e.total_minor} currency={e.currency} /> · {e.spent_at && new Date(e.spent_at).toLocaleDateString()}
                      </span>
                    </span>
                    <span className={`text-sm font-medium ${net > 0 ? 'text-success-700' : net < 0 ? 'text-accent-600' : 'text-muted-400'}`}>
                      {net === 0 ? '—' : <Money minor={Math.abs(net)} currency={e.currency} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {settle && (
        <Sheet title="Settle up" onClose={() => setSettle(null)}>
          <div className="space-y-4">
            <p className="text-sm text-muted-700">
              Record that <b>{name(settle.from)}</b> paid <b>{name(settle.to)}</b>. Papyris doesn’t move money; pay however you like, then record it here.
            </p>
            <MoneyInput value={settle.amount} currency={settle.currency} onChange={(amount) => setSettle({ ...settle, amount })} className="w-full text-lg" ariaLabel="Amount paid" />
            <button type="button" onClick={recordPayment} disabled={saving} className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold disabled:opacity-50">
              {saving ? 'Saving…' : 'Record payment'}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
};

export default ChatExpenses;
