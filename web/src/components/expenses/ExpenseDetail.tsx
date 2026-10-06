// src/components/expenses/ExpenseDetail.tsx
// One expense: who paid, who owes, the receipt photos, and the full history of changes.

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { categoryIcon, expenseService } from '../../services/expense.service';
import type { Expense, HistoryEntry } from '../../services/expense.service';
import { parseApiError } from '../../utils/apiError';
import { resolveMediaUrl } from '../../utils/media';
import AddExpenseSheet from './AddExpenseSheet';
import { displayName, Money, Segmented, Sheet, useChatMoney, useExpenseChanges } from './shared';

interface Props {
  expenseId: string;
  currentUserId: string;
  onClose: () => void;
}

const ACTION_ICONS: Record<HistoryEntry['action'], string> = {
  created: '➕', updated: '✏️', deleted: '🗑️', restored: '↩️', locked: '🔒', unlocked: '🔓',
};

const ExpenseDetail: React.FC<Props> = ({ expenseId, currentUserId, onClose }) => {
  const [expense, setExpense] = useState<Expense | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [tab, setTab] = useState<'details' | 'history'>('details');
  const [editing, setEditing] = useState<'manual' | 'receipt' | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const { members } = useChatMoney(expense?.conversation_id);

  const load = useCallback(async () => {
    try {
      const [e, h] = await Promise.all([expenseService.get(expenseId), expenseService.history(expenseId)]);
      setExpense(e);
      setHistory(h);
    } catch (error) {
      toast.error(parseApiError(error));
      onClose();
    }
  }, [expenseId, onClose]);

  useEffect(() => { load(); }, [load]);
  useExpenseChanges(expense?.conversation_id, load);

  const nameOf = (id: string) =>
    id === currentUserId ? 'You' : displayName(members.find((m) => m.id === id));

  const act = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      toast.success(done);
      load();
    } catch (error) {
      toast.error(parseApiError(error));
    }
  };

  if (!expense) {
    return (
      <Sheet title="Expense" onClose={onClose}>
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" />
        </div>
      </Sheet>
    );
  }

  if (editing) {
    return (
      <AddExpenseSheet
        conversationId={expense.conversation_id}
        currentUserId={currentUserId}
        expense={editing === 'manual' ? expense : undefined}
        receiptId={editing === 'receipt' ? expense.receipt_id || undefined : undefined}
        onClose={() => { setEditing(null); load(); }}
      />
    );
  }

  const myShare = expense.shares.find((s) => s.user_id === currentUserId)?.amount_minor || 0;
  const myPaid = expense.payers.find((p) => p.user_id === currentUserId)?.amount_minor || 0;
  const editable = expense.can_edit;

  return (
    <Sheet title={expense.description} onClose={onClose}>
      <div className="text-center mb-4">
        <div className="text-4xl">{categoryIcon(expense.category)}</div>
        <Money minor={expense.total_minor} currency={expense.currency} className="block text-3xl font-bold text-muted-900 mt-1" />
        <p className="text-sm text-muted-500">
          {expense.spent_at && new Date(expense.spent_at).toLocaleDateString()}
          {expense.source === 'receipt' && ' · from a receipt'}
          {expense.locked && ' · 🔒 locked'}
        </p>
        {expense.deleted && <p className="mt-2 text-sm font-medium text-accent-600">This expense was deleted</p>}
        <p className={`mt-2 text-sm font-medium ${myPaid - myShare > 0 ? 'text-success-700' : myPaid - myShare < 0 ? 'text-accent-600' : 'text-muted-500'}`}>
          {myPaid - myShare > 0 && <>You get back <Money minor={myPaid - myShare} currency={expense.currency} /></>}
          {myPaid - myShare < 0 && <>You owe <Money minor={myShare - myPaid} currency={expense.currency} /></>}
          {myPaid === myShare && (myShare ? 'You’re even on this one' : 'You’re not involved')}
        </p>
      </div>

      <div className="flex justify-center mb-4">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'details', label: 'Details' }, { value: 'history', label: `History (${history.length})` }]} />
      </div>

      {tab === 'details' ? (
        <div className="space-y-5">
          <section>
            <h3 className="text-sm font-semibold text-muted-700 mb-1">Paid by</h3>
            {expense.payers.map((p) => (
              <div key={p.user_id} className="flex justify-between text-sm py-1">
                <span>{nameOf(p.user_id)}</span>
                <Money minor={p.amount_minor} currency={expense.currency} />
              </div>
            ))}
          </section>
          <section>
            <h3 className="text-sm font-semibold text-muted-700 mb-1">Split {expense.split_mode === 'itemized' ? 'by item' : expense.split_mode === 'equal' ? 'equally' : `by ${expense.split_mode}`}</h3>
            {expense.shares.map((s) => (
              <div key={s.user_id} className="flex justify-between text-sm py-1">
                <span>{nameOf(s.user_id)}{s.split_value && expense.split_mode === 'percent' ? ` (${s.split_value}%)` : ''}</span>
                <Money minor={s.amount_minor} currency={expense.currency} />
              </div>
            ))}
          </section>
          {expense.receipt_images.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-muted-700 mb-2">Receipt</h3>
              <div className="flex gap-2">
                {expense.receipt_images.map((src) => (
                  <button key={src} type="button" onClick={() => setPhoto(src)} className="w-16 h-20 rounded-lg overflow-hidden border border-muted-200">
                    <img src={resolveMediaUrl(src)} alt="Receipt" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {!expense.deleted && editable && (
              <button type="button" onClick={() => setEditing('manual')} className="px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium">
                {expense.split_mode === 'itemized' ? 'Edit details & payers' : 'Edit'}
              </button>
            )}
            {!expense.deleted && editable && expense.receipt_id && (
              <button type="button" onClick={() => setEditing('receipt')} className="px-3 py-2 rounded-lg bg-primary-50 text-primary-700 text-sm font-medium">
                Edit items
              </button>
            )}
            {expense.can_admin && !expense.deleted && (
              <button type="button" onClick={() => act(() => expenseService.lock(expense.id, !expense.locked), expense.locked ? 'Unlocked' : 'Locked')} className="px-3 py-2 rounded-lg bg-muted-100 text-sm font-medium">
                {expense.locked ? 'Unlock' : 'Lock'}
              </button>
            )}
            {expense.can_delete && !expense.locked && (
              <button
                type="button"
                onClick={() => window.confirm('Delete this expense? It can be restored later.') && act(() => expenseService.remove(expense.id), 'Expense deleted')}
                className="ml-auto px-3 py-2 rounded-lg text-accent-600 hover:bg-accent-50 text-sm font-medium"
              >
                Delete
              </button>
            )}
            {expense.deleted && (expense.can_admin || expense.created_by === currentUserId) && (
              <button type="button" onClick={() => act(() => expenseService.restore(expense.id), 'Expense restored')} className="px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium">
                Restore
              </button>
            )}
          </div>
        </div>
      ) : (
        <ol className="space-y-3">
          {history.map((h) => (
            <li key={h.id} className="flex gap-3">
              <span className="text-lg leading-6">{ACTION_ICONS[h.action]}</span>
              <div className="min-w-0">
                <p className="text-sm text-muted-900">
                  <span className="font-semibold">{h.actor ? (h.actor.id === currentUserId ? 'You' : h.actor.username) : 'Someone'}</span> {h.summary}
                </p>
                <p className="text-xs text-muted-500">{new Date(h.created_at).toLocaleString()}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {photo && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => setPhoto(null)}>
          <img src={resolveMediaUrl(photo)} alt="Receipt" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </Sheet>
  );
};

export default ExpenseDetail;
