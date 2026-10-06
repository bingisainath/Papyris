// src/components/expenses/ManualExpenseForm.tsx
// Add or edit an expense by hand: amount, who paid (one or several people), how to split.

import React, { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { CATEGORIES, expenseService } from '../../services/expense.service';
import CategoryIcon from './CategoryIcon';
import type { Expense, ExpenseInput } from '../../services/expense.service';
import { parseApiError } from '../../utils/apiError';
import { formatMinor, parseMajor, toMajorString } from '../../utils/money';
import { CurrencySelect, displayName, firstName, MoneyInput, PersonToggle, Segmented } from './shared';
import type { Member } from './shared';

export type PayerDraft = { user_id: string; amount: string };

/** "Paid by": one person (default: you) or several people with amounts. */
export const PayersEditor: React.FC<{
  members: Member[];
  currentUserId: string;
  currency: string;
  totalMinor: number | null;
  value: PayerDraft[] | null; // null = one person paid it all (see singlePayer)
  singlePayer: string;
  onChange: (value: PayerDraft[] | null, singlePayer: string) => void;
}> = ({ members, currentUserId, currency, totalMinor, value, singlePayer, onChange }) => {
  const multiple = value !== null;
  const paidMinor = (value || []).reduce((sum, p) => sum + (parseMajor(p.amount, currency) || 0), 0);
  const remaining = totalMinor === null ? null : totalMinor - paidMinor;
  const nameOf = (id: string) => (id === currentUserId ? 'You' : displayName(members.find((m) => m.id === id)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-700">Paid by</span>
        <Segmented
          value={multiple ? 'multiple' : 'one'}
          options={[{ value: 'one', label: 'One person' }, { value: 'multiple', label: 'Several' }]}
          onChange={(mode) => {
            if (mode === 'one') onChange(null, singlePayer);
            else onChange([{ user_id: singlePayer, amount: totalMinor !== null ? toMajorString(totalMinor, currency) : '' }], singlePayer);
          }}
        />
      </div>

      {!multiple ? (
        <div className="flex flex-wrap gap-3">
          {members.map((m) => (
            <PersonToggle
              key={m.id}
              member={m}
              selected={m.id === singlePayer}
              onToggle={() => onChange(null, m.id)}
              label={m.id === currentUserId ? 'You' : firstName(m)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => {
            const entry = value!.find((p) => p.user_id === m.id);
            return (
              <div key={m.id} className="flex items-center gap-3">
                <PersonToggle
                  member={m}
                  selected={!!entry}
                  onToggle={() =>
                    onChange(entry ? value!.filter((p) => p.user_id !== m.id) : [...value!, { user_id: m.id, amount: '' }], singlePayer)
                  }
                />
                <span className="flex-1 text-sm text-muted-800 truncate">{nameOf(m.id)}</span>
                {entry && (
                  <MoneyInput
                    value={entry.amount}
                    currency={currency}
                    className="w-28"
                    ariaLabel={`${nameOf(m.id)} paid`}
                    onChange={(amount) => onChange(value!.map((p) => (p.user_id === m.id ? { ...p, amount } : p)), singlePayer)}
                  />
                )}
              </div>
            );
          })}
          {remaining !== null && remaining !== 0 && (
            <p className="text-sm text-accent-600">
              {remaining > 0 ? `${formatMinor(remaining, currency)} still to assign` : `${formatMinor(-remaining, currency)} too much`}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

type ManualMode = 'equal' | 'exact' | 'percent' | 'shares';

interface Props {
  conversationId: string;
  members: Member[];
  currentUserId: string;
  defaultCurrency: string;
  expense?: Expense; // editing
  onDone: (expense: Expense) => void;
}

const ManualExpenseForm: React.FC<Props> = ({ conversationId, members, currentUserId, defaultCurrency, expense, onDone }) => {
  const editingItemized = expense?.split_mode === 'itemized';
  const [description, setDescription] = useState(expense?.description || '');
  const [category, setCategory] = useState(expense?.category || 'other');
  const [currency, setCurrency] = useState(expense?.currency || defaultCurrency);
  const [amount, setAmount] = useState(expense ? toMajorString(expense.total_minor, expense.currency) : '');
  const [date, setDate] = useState((expense?.spent_at || new Date().toISOString()).slice(0, 10));
  const [mode, setMode] = useState<ManualMode>(
    expense && expense.split_mode !== 'itemized' ? (expense.split_mode as ManualMode) : 'equal'
  );
  const [selected, setSelected] = useState<string[]>(
    expense ? expense.shares.map((s) => s.user_id) : members.map((m) => m.id)
  );
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (!expense) return {};
    return Object.fromEntries(expense.shares.map((s) => [
      s.user_id,
      expense.split_mode === 'exact' ? toMajorString(s.amount_minor, expense.currency) : s.split_value || '',
    ]));
  });
  const [singlePayer, setSinglePayer] = useState(
    expense?.payers.length === 1 ? expense.payers[0].user_id : currentUserId
  );
  const [payers, setPayers] = useState<PayerDraft[] | null>(
    expense && expense.payers.length > 1
      ? expense.payers.map((p) => ({ user_id: p.user_id, amount: toMajorString(p.amount_minor, expense.currency) }))
      : null
  );
  const [saving, setSaving] = useState(false);

  const totalMinor = parseMajor(amount, currency);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const preview = useMemo(() => {
    if (!totalMinor || totalMinor <= 0 || !selected.length) return null;
    if (mode === 'equal') {
      const base = Math.floor(totalMinor / selected.length);
      const extra = totalMinor - base * selected.length;
      return Object.fromEntries(selected.map((id, i) => [id, base + (i < extra ? 1 : 0)]));
    }
    if (mode === 'exact') return Object.fromEntries(selected.map((id) => [id, parseMajor(values[id] || '', currency) || 0]));
    const weights = selected.map((id) => Number((values[id] || '').replace(',', '.')) || 0);
    const sum = weights.reduce((a, b) => a + b, 0);
    if (!sum) return null;
    return Object.fromEntries(selected.map((id, i) => [id, Math.round((totalMinor * weights[i]) / (mode === 'percent' ? 100 : sum))]));
  }, [totalMinor, selected, mode, values, currency]);

  const problem = (() => {
    if (!description.trim()) return 'Add a description';
    if (!totalMinor || totalMinor <= 0) return 'Enter the amount';
    if (!editingItemized && !selected.length) return 'Choose who it’s split between';
    if (mode === 'exact' && !editingItemized && preview) {
      const sum = Object.values(preview).reduce((a, b) => a + b, 0);
      if (sum !== totalMinor) return `Amounts add up to ${formatMinor(sum, currency)}, not ${formatMinor(totalMinor, currency)}`;
    }
    if (mode === 'percent' && !editingItemized) {
      const sum = selected.reduce((a, id) => a + (Number((values[id] || '').replace(',', '.')) || 0), 0);
      if (Math.abs(sum - 100) > 1e-9) return `Percentages add up to ${sum}%, not 100%`;
    }
    if (payers) {
      const paid = payers.reduce((a, p) => a + (parseMajor(p.amount, currency) || 0), 0);
      if (paid !== totalMinor) return 'What people paid must add up to the total';
    }
    return null;
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem) {
      toast.error(problem);
      return;
    }
    const body: ExpenseInput = {
      description: description.trim(),
      category,
      currency,
      amount,
      spent_at: new Date(`${date}T12:00:00`).toISOString(),
      split_mode: editingItemized ? 'itemized' : mode,
      splits: selected.map((id) => ({ user_id: id, value: mode === 'equal' ? null : values[id] || '0' })),
      payers: payers ?? [{ user_id: singlePayer, amount }],
      version: expense?.version,
    };
    setSaving(true);
    try {
      const saved = expense ? await expenseService.update(expense.id, body) : await expenseService.create(conversationId, body);
      toast.success(expense ? 'Expense updated' : 'Expense added');
      onDone(saved);
    } catch (error) {
      toast.error(parseApiError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form id="manual-expense-form" onSubmit={submit} className="space-y-5">
      <div className="flex gap-2">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was it for?"
          aria-label="Description"
          maxLength={200}
          autoFocus={!expense}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-muted-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="flex gap-2">
        <CurrencySelect value={currency} onChange={setCurrency} className={editingItemized ? 'pointer-events-none opacity-60' : ''} />
        <MoneyInput value={amount} onChange={setAmount} currency={currency} className="flex-1 min-w-0 text-lg font-semibold" ariaLabel="Amount" />
      </div>
      {editingItemized && (
        <p className="text-xs text-muted-500 -mt-3">This came from a receipt: change items and who they’re for on the receipt.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm border ${category === c.id ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-muted-200 text-muted-600'}`}
          >
            <CategoryIcon category={c.id} bare /> {c.label}
          </button>
        ))}
      </div>

      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-muted-700">Date</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-2 py-1.5 rounded-lg border border-muted-300" />
      </label>

      <PayersEditor
        members={members}
        currentUserId={currentUserId}
        currency={currency}
        totalMinor={totalMinor}
        value={payers}
        singlePayer={singlePayer}
        onChange={(value, single) => { setPayers(value); setSinglePayer(single); }}
      />

      {!editingItemized && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-700">Split</span>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'equal', label: 'Equally' },
                { value: 'exact', label: 'Amounts' },
                { value: 'percent', label: '%' },
                { value: 'shares', label: 'Shares' },
              ]}
            />
          </div>
          <div className="space-y-2">
            {members.map((m) => {
              const on = selected.includes(m.id);
              return (
                <div key={m.id} className="flex items-center gap-3">
                  <PersonToggle member={m} selected={on} onToggle={() => toggle(m.id)} />
                  <span className="flex-1 text-sm text-muted-800 truncate">{m.id === currentUserId ? 'You' : displayName(m)}</span>
                  {on && mode !== 'equal' && (
                    mode === 'exact' ? (
                      <MoneyInput
                        value={values[m.id] || ''}
                        currency={currency}
                        className="w-28"
                        ariaLabel={`${displayName(m)} owes`}
                        onChange={(v) => setValues((s) => ({ ...s, [m.id]: v }))}
                      />
                    ) : (
                      <input
                        inputMode="decimal"
                        value={values[m.id] || ''}
                        placeholder={mode === 'percent' ? '%' : '1'}
                        aria-label={`${displayName(m)} ${mode}`}
                        onChange={(e) => setValues((s) => ({ ...s, [m.id]: e.target.value }))}
                        className="w-20 px-2 py-2 rounded-lg border border-muted-300 text-right"
                      />
                    )
                  )}
                  {on && preview && mode !== 'exact' && (
                    <span className="w-24 text-right text-sm tabular-nums text-muted-600">{formatMinor(preview[m.id] || 0, currency)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {problem && (description || amount) && <p className="text-sm text-accent-600">{problem}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold disabled:opacity-50"
      >
        {saving ? 'Saving…' : expense ? 'Save changes' : 'Add expense'}
      </button>
    </form>
  );
};

export default ManualExpenseForm;
