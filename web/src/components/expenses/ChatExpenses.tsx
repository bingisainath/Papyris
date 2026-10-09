// src/components/expenses/ChatExpenses.tsx
// Money in one chat, in four tabs:
//   You       only your own numbers: what you paid, your share, who you owe and who owes you
//   Balances  every member: paid, share, balance, and the payments that settle everyone up
//   Summary   total spent, by category, by member and by month
//   History   expenses and payments together, filtered by date, category, member or type

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { expenseService } from '../../services/expense.service';
import type { ActivityFilters, ActivityItem, Balances, CurrencySummary, ExpenseSummary } from '../../services/expense.service';
import { parseApiError } from '../../utils/apiError';
import { decimalsFor, toMajorString } from '../../utils/money';
import { payOptions } from '../../utils/pay';
import type { PayHandles } from '../../utils/pay';
import { ArrowRightLeft, BarChart3, BellRing, CheckCircle2, Download, History, Lock, ScrollText, Scale, User, Wallet } from 'lucide-react';
import { Avatar } from '../atoms';
import CategoryIcon from './CategoryIcon';
import { displayName, Money, MoneyInput, Segmented, Sheet, useExpenseChanges } from './shared';

interface Props {
  conversationId: string;
  currentUserId: string;
  onOpenExpense: (expenseId: string) => void;
  onAddExpense: () => void;
}

type Tab = 'you' | 'balances' | 'summary' | 'history';
type SettleDraft = { from: string; to: string; currency: string; amount: string };

const CATEGORIES = ['groceries', 'food', 'drinks', 'transport', 'travel', 'rent', 'utilities', 'household', 'entertainment', 'shopping', 'health', 'gifts', 'other'];
const label = (category: string) => category.charAt(0).toUpperCase() + category.slice(1);
const monthLabel = (month: string) => new Date(`${month}-01T12:00:00`).toLocaleDateString([], { month: 'long', year: 'numeric' });

type DateRange = 'all' | 'month' | '30d' | '90d' | 'year';
function rangeOf(range: DateRange): Pick<ActivityFilters, 'date_from'> {
  const now = new Date();
  const from = {
    all: null,
    month: new Date(now.getFullYear(), now.getMonth(), 1),
    '30d': new Date(now.getTime() - 30 * 86400e3),
    '90d': new Date(now.getTime() - 90 * 86400e3),
    year: new Date(now.getFullYear(), 0, 1),
  }[range];
  return from ? { date_from: from.toISOString() } : {};
}

const Spinner = () => <div className="py-10 flex justify-center"><div className="w-8 h-8 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" /></div>;

const ChatExpenses: React.FC<Props> = ({ conversationId, currentUserId, onOpenExpense, onAddExpense }) => {
  const [tab, setTab] = useState<Tab>('you');
  const [balances, setBalances] = useState<Balances | null>(null);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [settle, setSettle] = useState<SettleDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [version, setVersion] = useState(0); // bumps when anything changes, so History reloads too

  const load = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([expenseService.balances(conversationId), expenseService.summary(conversationId)]);
      setBalances(b);
      setSummary(s);
      setVersion((v) => v + 1);
    } catch (error) {
      toast.error(parseApiError(error));
    }
  }, [conversationId]);

  useEffect(() => { load(); }, [load]);
  useExpenseChanges(conversationId, load);

  const users = summary?.users || balances?.users || {};
  const name = (id: string) => (id === currentUserId ? 'You' : displayName(users[id]));

  const download = async () => {
    setDownloading(true);
    try {
      await expenseService.downloadExcel(conversationId);
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setDownloading(false);
    }
  };

  const recordPayment = async () => {
    if (!settle) return;
    setSaving(true);
    try {
      await expenseService.settle(conversationId, { from_user: settle.from, to_user: settle.to, currency: settle.currency, amount: settle.amount });
      toast.success('Payment recorded');
      setSettle(null);
      load();
    } catch (error) {
      toast.error(parseApiError(error));
    } finally {
      setSaving(false);
    }
  };

  if (!balances || !summary) return <Spinner />;
  const empty = summary.currencies.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented value={tab} onChange={setTab} options={[
          { value: 'you', label: 'You', icon: User },
          { value: 'balances', label: 'Balances', icon: Scale },
          { value: 'summary', label: 'Summary', icon: BarChart3 },
          { value: 'history', label: 'History', icon: History },
        ]} />
        <div className="flex items-center gap-2">
          {!empty && (
            <button type="button" onClick={download} disabled={downloading} title="Download as Excel" aria-label="Download as Excel"
              className="p-1.5 rounded-lg text-muted-600 hover:bg-muted-100 disabled:opacity-50">
              <Download size={18} />
            </button>
          )}
          <button type="button" onClick={onAddExpense} className="px-3 py-1.5 text-sm rounded-lg bg-primary-600 text-white font-medium">+ Add expense</button>
        </div>
      </div>

      {empty && tab !== 'history' ? (
        <p className="text-sm text-muted-500 py-8 text-center">No expenses yet. Add one, or scan a receipt from the chat.</p>
      ) : tab === 'you' ? (
        <YouTab summary={summary} balances={balances} me={currentUserId} name={name} users={users} onSettle={setSettle} conversationId={conversationId} />
      ) : tab === 'balances' ? (
        <BalancesTab summary={summary} balances={balances} me={currentUserId} name={name} users={users} onSettle={setSettle} />
      ) : tab === 'summary' ? (
        <SummaryTab summary={summary} name={name} users={users} />
      ) : (
        <HistoryTab conversationId={conversationId} me={currentUserId} name={name} users={users} version={version} onOpenExpense={onOpenExpense} onChanged={load} />
      )}

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

type Users = ExpenseSummary['users'];
interface TabProps { summary: ExpenseSummary; balances: Balances; me: string; name: (id: string) => string; users: Users; onSettle: (d: SettleDraft) => void; conversationId?: string }

/** "Pay": the payee's payment apps, opened with the amount (or with it copied, for Revolut). */
const PayMenu: React.FC<{ pay?: PayHandles; minor: number; currency: string; payee: string }> = ({ pay, minor, currency, payee }) => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('click', close); // a click anywhere else closes the menu
    return () => window.removeEventListener('click', close);
  }, [open]);
  const options = payOptions(pay, minor, currency, decimalsFor(currency), payee, 'Papyris');
  if (!options.length) return null;
  const go = async (o: (typeof options)[number]) => {
    setOpen(false);
    if (o.copyAmount) {
      await navigator.clipboard?.writeText(toMajorString(minor, currency)).catch(() => undefined);
      toast.info(`Amount copied: paste it in ${o.label}`);
    }
    window.open(o.url, '_blank', 'noopener');
  };
  return (
    <span className="relative">
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} aria-haspopup="menu" aria-expanded={open}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-primary-700 text-white hover:bg-primary-800">
        <Wallet className="w-3.5 h-3.5" /> Pay
      </button>
      {open && (
        <span role="menu" className="absolute right-0 z-10 mt-1 w-40 rounded-xl border border-muted-200 bg-white shadow-elevated py-1">
          {options.map((o) => (
            <button key={o.app} type="button" role="menuitem" onClick={() => go(o)} className="block w-full px-3 py-2 text-left text-sm text-muted-800 hover:bg-muted-50">
              {o.label}{o.copyAmount ? <span className="block text-[11px] text-muted-500">copies the amount</span> : null}
            </button>
          ))}
        </span>
      )}
    </span>
  );
};

const RemindButton: React.FC<{ conversationId: string; userId: string; currency: string }> = ({ conversationId, userId, currency }) => {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const remind = async () => {
    setBusy(true);
    try {
      await expenseService.remind(conversationId, userId, currency);
      setSent(true);
      toast.success('Reminder sent');
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={remind} disabled={busy || sent} title="Send them a notification"
      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-muted-200 text-muted-700 hover:bg-muted-50 disabled:opacity-50">
      <BellRing className="w-3.5 h-3.5" /> {sent ? 'Reminded' : 'Remind'}
    </button>
  );
};

const NetText: React.FC<{ net: number; currency: string; you?: boolean }> = ({ net, currency, you }) => (
  <span className={`font-semibold ${net > 0 ? 'text-success-700' : net < 0 ? 'text-accent-600' : 'text-muted-500'}`}>
    {net > 0 ? (you ? 'You get back ' : 'Gets back ') : net < 0 ? (you ? 'You owe ' : 'Owes ') : 'Settled'}
    {net !== 0 && <Money minor={Math.abs(net)} currency={currency} />}
  </span>
);

const Stat: React.FC<{ label: string; minor: number; currency: string }> = ({ label: text, minor, currency }) => (
  <div className="p-3 rounded-xl bg-muted-50">
    <p className="text-xs text-muted-500">{text}</p>
    <p className="text-base font-semibold text-muted-900"><Money minor={minor} currency={currency} /></p>
  </div>
);

// ---------------------------------------------------------------- You (6.1)

const YouTab: React.FC<TabProps> = ({ summary, balances, me, name, users, onSettle, conversationId }) => (
  <div className="space-y-4">
    {summary.currencies.map((c) => {
      const debts = balances.currencies.find((b) => b.currency === c.currency)?.debts.filter((d) => d.from_user === me || d.to_user === me) || [];
      return (
        <section key={c.currency} className="p-4 rounded-2xl border border-muted-200 space-y-3" aria-label={`Your ${c.currency} balance`}>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-muted-500">{c.currency}</span>
            <NetText net={c.me.net_minor} currency={c.currency} you />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="You paid" minor={c.me.paid_minor} currency={c.currency} />
            <Stat label="Your share" minor={c.me.share_minor} currency={c.currency} />
            <Stat label="You paid back" minor={c.me.sent_minor} currency={c.currency} />
            <Stat label="Paid back to you" minor={c.me.received_minor} currency={c.currency} />
          </div>
          {debts.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-success-700"><CheckCircle2 className="w-4 h-4" /> Nothing to settle</p>
          ) : (
            <ul className="space-y-2">
              {debts.map((d) => {
                const other = d.from_user === me ? d.to_user : d.from_user;
                const iOwe = d.from_user === me;
                return (
                  <li key={`${d.from_user}-${d.to_user}`} className="flex items-center gap-3 text-sm">
                    <Avatar src={users[other]?.avatar} alt={displayName(users[other])} size="sm" />
                    <span className="flex-1 min-w-0 truncate">{iOwe ? <>You owe <b>{name(other)}</b></> : <><b>{name(other)}</b> owes you</>}</span>
                    <Money minor={d.amount_minor} currency={c.currency} className={`font-semibold ${iOwe ? 'text-accent-600' : 'text-success-700'}`} />
                    {iOwe
                      ? <PayMenu pay={users[other]?.pay} minor={d.amount_minor} currency={c.currency} payee={displayName(users[other])} />
                      : conversationId && <RemindButton conversationId={conversationId} userId={other} currency={c.currency} />}
                    <button type="button" onClick={() => onSettle({ from: d.from_user, to: d.to_user, currency: c.currency, amount: toMajorString(d.amount_minor, c.currency) })}
                      className="px-2.5 py-1 text-xs rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100">
                      {iOwe ? 'Settle' : 'Mark paid'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      );
    })}
    <p className="text-xs text-muted-400">Only your own amounts are shown here. See Balances for everyone.</p>
  </div>
);

// ---------------------------------------------------------------- Balances (6.2)

const BalancesTab: React.FC<TabProps> = ({ summary, balances, me, name, users, onSettle }) => (
  <div className="space-y-4">
    {summary.currencies.map((c) => {
      const debts = balances.currencies.find((b) => b.currency === c.currency)?.debts || [];
      return (
        <section key={c.currency} className="p-4 rounded-2xl border border-muted-200" aria-label={`${c.currency} balances`}>
          <h3 className="text-sm font-medium text-muted-500 mb-2">{c.currency} · each member</h3>
          <ul className="divide-y divide-muted-100">
            {c.members.map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 py-2.5">
                <Avatar src={users[m.user_id]?.avatar} alt={displayName(users[m.user_id])} size="sm" />
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm truncate ${m.user_id === me ? 'font-semibold text-muted-900' : 'text-muted-800'}`}>{name(m.user_id)}</span>
                  <span className="block text-xs text-muted-500">
                    Paid <Money minor={m.paid_minor} currency={c.currency} /> · share <Money minor={m.share_minor} currency={c.currency} />
                  </span>
                </span>
                <span className="text-sm"><NetText net={m.net_minor} currency={c.currency} /></span>
              </li>
            ))}
          </ul>
          <h3 className="text-sm font-medium text-muted-500 mt-4 mb-2 flex items-center gap-1.5"><ArrowRightLeft className="w-4 h-4" /> To settle up</h3>
          {debts.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-success-700"><CheckCircle2 className="w-4 h-4" /> Everyone is settled up</p>
          ) : (
            <ul className="space-y-2">
              {debts.map((d) => (
                <li key={`${d.from_user}-${d.to_user}`} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 min-w-0 truncate"><b>{name(d.from_user)}</b> {d.from_user === me ? 'pay' : 'pays'} <b>{d.to_user === me ? 'you' : name(d.to_user)}</b></span>
                  <Money minor={d.amount_minor} currency={c.currency} className="font-semibold" />
                  <button type="button" onClick={() => onSettle({ from: d.from_user, to: d.to_user, currency: c.currency, amount: toMajorString(d.amount_minor, c.currency) })}
                    className="px-2.5 py-1 text-xs rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100">Record</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    })}
    <p className="text-xs text-muted-400">
      {balances.simplified ? 'Payments are simplified to the fewest needed.' : 'Showing who owes whom directly.'} Change this in the chat’s info.
    </p>
  </div>
);

// ---------------------------------------------------------------- Summary (6.3)

const Bar: React.FC<{ part: number; whole: number }> = ({ part, whole }) => (
  <div className="h-2 rounded-full bg-muted-100 overflow-hidden"><div className="h-full rounded-full bg-primary-500" style={{ width: `${whole ? Math.max(2, (part / whole) * 100) : 0}%` }} /></div>
);

const SummaryTab: React.FC<{ summary: ExpenseSummary; name: (id: string) => string; users: Users }> = ({ summary, name, users }) => (
  <div className="space-y-4">
    {summary.currencies.map((c: CurrencySummary) => {
      const topPaid = Math.max(...c.members.map((m) => Math.max(m.paid_minor, m.share_minor)), 1);
      const topMonth = Math.max(...c.by_month.map((m) => m.total_minor), 1);
      return (
        <section key={c.currency} className="p-4 rounded-2xl border border-muted-200 space-y-5" aria-label={`${c.currency} summary`}>
          <div>
            <p className="text-sm text-muted-500">Total spent · {c.currency}</p>
            <p className="text-3xl font-bold text-muted-900"><Money minor={c.total_minor} currency={c.currency} /></p>
            <p className="text-xs text-muted-500">{c.count} expense{c.count === 1 ? '' : 's'}</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-900 mb-2">By category</h3>
            <ul className="space-y-2.5">
              {c.by_category.map((cat) => (
                <li key={cat.category} className="flex items-center gap-3">
                  <CategoryIcon category={cat.category} size="sm" />
                  <span className="flex-1 min-w-0">
                    <span className="flex justify-between text-sm"><span className="text-muted-800">{label(cat.category)} <span className="text-xs text-muted-400">· {cat.count}</span></span>
                      <span className="font-medium"><Money minor={cat.total_minor} currency={c.currency} /> <span className="text-xs text-muted-400">{Math.round((cat.total_minor / c.total_minor) * 100)}%</span></span></span>
                    <Bar part={cat.total_minor} whole={c.total_minor} />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-900 mb-2">By member <span className="font-normal text-xs text-muted-500">paid · share</span></h3>
            <ul className="space-y-2.5">
              {c.members.filter((m) => m.paid_minor || m.share_minor).map((m) => (
                <li key={m.user_id} className="flex items-center gap-3">
                  <Avatar src={users[m.user_id]?.avatar} alt={displayName(users[m.user_id])} size="sm" />
                  <span className="flex-1 min-w-0 space-y-1">
                    <span className="flex justify-between text-sm"><span className="truncate text-muted-800">{name(m.user_id)}</span>
                      <span><Money minor={m.paid_minor} currency={c.currency} className="font-medium" /> · <Money minor={m.share_minor} currency={c.currency} className="text-muted-500" /></span></span>
                    <Bar part={m.paid_minor} whole={topPaid} />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-900 mb-2">By month</h3>
            <ul className="space-y-2">
              {c.by_month.map((m) => (
                <li key={m.month} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-sm">
                  <span className="text-muted-700">{monthLabel(m.month)}</span>
                  <Bar part={m.total_minor} whole={topMonth} />
                  <Money minor={m.total_minor} currency={c.currency} className="font-medium" />
                </li>
              ))}
            </ul>
          </div>
        </section>
      );
    })}
  </div>
);

// ---------------------------------------------------------------- History with filters (6.4)

const HistoryTab: React.FC<{
  conversationId: string; me: string; name: (id: string) => string; users: Users; version: number;
  onOpenExpense: (id: string) => void; onChanged: () => void;
}> = ({ conversationId, me, name, users, version, onOpenExpense, onChanged }) => {
  const [range, setRange] = useState<DateRange>('all');
  const [category, setCategory] = useState('');
  const [member, setMember] = useState('');
  const [kind, setKind] = useState<'' | 'expense' | 'settlement'>('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [items, setItems] = useState<ActivityItem[] | null>(null);

  const filters = useMemo<ActivityFilters>(() => ({
    ...rangeOf(range), ...(category ? { category } : {}), ...(member ? { member } : {}), ...(kind ? { kind } : {}), include_deleted: showDeleted,
  }), [range, category, member, kind, showDeleted]);

  useEffect(() => {
    let alive = true;
    expenseService.activity(conversationId, filters).then((r) => { if (alive) setItems(r.items); }).catch((e) => toast.error(parseApiError(e)));
    return () => { alive = false; };
  }, [conversationId, filters, version]);

  const removePayment = async (id: string) => {
    if (!window.confirm('Remove this payment? Balances go back to how they were before it.')) return;
    try {
      await expenseService.removeSettlement(id);
      onChanged();
    } catch (e) {
      toast.error(parseApiError(e));
    }
  };

  const select = 'px-2.5 py-1.5 text-sm rounded-lg border border-muted-200 bg-white';
  const filtered = range !== 'all' || category || member || kind;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
        <select value={range} onChange={(e) => setRange(e.target.value as DateRange)} aria-label="Date" className={select}>
          <option value="all">All time</option>
          <option value="month">This month</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 3 months</option>
          <option value="year">This year</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className={select}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}
        </select>
        <select value={member} onChange={(e) => setMember(e.target.value)} aria-label="Member" className={select}>
          <option value="">Everyone</option>
          {Object.keys(users).map((id) => <option key={id} value={id}>{name(id)}</option>)}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Type" className={select}>
          <option value="">Expenses and payments</option>
          <option value="expense">Expenses only</option>
          <option value="settlement">Payments only</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-muted-500">
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} /> Deleted
        </label>
        {filtered && (
          <button type="button" onClick={() => { setRange('all'); setCategory(''); setMember(''); setKind(''); }} className="text-xs font-medium text-primary-700 hover:underline">Clear</button>
        )}
      </div>

      {!items ? <Spinner /> : items.length === 0 ? (
        <p className="text-sm text-muted-500 py-6 text-center">{filtered ? 'Nothing matches these filters.' : 'No expenses or payments yet.'}</p>
      ) : (
        <ul className="divide-y divide-muted-100" aria-label="History">
          {items.map((it) => {
            const when = new Date(it.at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
            if (it.kind === 'settlement') {
              return (
                <li key={`s-${it.id}`} className="flex items-center gap-3 py-2.5">
                  <span className="inline-flex w-8 h-8 flex-shrink-0 items-center justify-center rounded-full bg-success-50 text-success-700"><ArrowRightLeft className="w-4 h-4" /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-muted-900 truncate">{name(it.from_user)} paid {it.to_user === me ? 'you' : name(it.to_user)}</span>
                    <span className="block text-xs text-muted-500">Payment · {when}{it.note ? ` · ${it.note}` : ''}</span>
                  </span>
                  <Money minor={it.amount_minor} currency={it.currency} className="text-sm font-medium" />
                  {(it.created_by === me) && (
                    <button type="button" onClick={() => removePayment(it.id)} className="text-xs text-muted-500 hover:text-accent-600" aria-label="Remove payment">Remove</button>
                  )}
                </li>
              );
            }
            const net = (it.payers.find((p) => p.user_id === me)?.amount_minor || 0) - (it.shares.find((s) => s.user_id === me)?.amount_minor || 0);
            const payer = it.payers.length > 1 ? `${it.payers.length} people` : name(it.payers[0]?.user_id || '');
            return (
              <li key={`e-${it.id}`}>
                <button type="button" onClick={() => onOpenExpense(it.id)} className={`w-full flex items-center gap-3 py-2.5 text-left ${it.deleted ? 'opacity-50' : ''}`}>
                  <CategoryIcon category={it.category} size="sm" />
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm font-medium text-muted-900 truncate ${it.deleted ? 'line-through' : ''}`}>
                      {it.description}
                      {it.locked && <Lock className="inline w-3.5 h-3.5 ml-1 text-muted-400" aria-label="Locked" />}
                      {it.source === 'receipt' && <ScrollText className="inline w-3.5 h-3.5 ml-1 text-primary-500" aria-label="From a receipt" />}
                    </span>
                    <span className="block text-xs text-muted-500">{payer} paid <Money minor={it.total_minor} currency={it.currency} /> · {label(it.category)} · {when}</span>
                  </span>
                  <span className={`text-sm font-medium ${net > 0 ? 'text-success-700' : net < 0 ? 'text-accent-600' : 'text-muted-400'}`} title={net > 0 ? 'You lent' : net < 0 ? 'You borrowed' : 'Not involved'}>
                    {net === 0 ? '—' : <>{net > 0 ? '+' : '−'}<Money minor={Math.abs(net)} currency={it.currency} /></>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ChatExpenses;
