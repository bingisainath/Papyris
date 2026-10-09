// src/screens/expenses/ChatExpensesScreen.tsx
// One chat's money, in four tabs (same as web/src/components/expenses/ChatExpenses.tsx):
//   You       only your own numbers: what you paid, your share, who you owe and who owes you
//   Balances  every member: paid, share, balance, and the payments that settle everyone up
//   Summary   total spent, by category, by member and by month
//   History   expenses and payments together, filtered by date, category, member or type
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowRightLeft, BellRing, CheckCircle2, ChevronDown, Download, Lock, Plus, ScrollText, Wallet } from 'lucide-react-native';
import { payOptions } from '../../utils/pay';
import type { PayHandles } from '../../utils/pay';
import Avatar from '../../components/Avatar';
import { Button } from '../../components/ui';
import { expenseService } from '../../api/expenses';
import type { ActivityFilters, ActivityItem, Balances, CurrencySummary, ExpenseSummary } from '../../api/expenses';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../store/auth';
import { decimalsFor, formatMinor, parseMajor, toMajorString } from '../../utils/money';
import { colors, radius, space } from '../../theme';
import type { AppStackParams } from '../../navigation/types';
import CategoryIcon from './CategoryIcon';
import { useExpenseChanges } from './useMembers';
import { showAlert } from '../../components/Dialog';

type Tab = 'you' | 'balances' | 'summary' | 'history';
type Settle = { from: string; to: string; currency: string; amount: string };
type Users = ExpenseSummary['users'];

const TABS: { value: Tab; label: string }[] = [
  { value: 'you', label: 'You' }, { value: 'balances', label: 'Balances' }, { value: 'summary', label: 'Summary' }, { value: 'history', label: 'History' },
];
const CATEGORIES = ['groceries', 'food', 'drinks', 'transport', 'travel', 'rent', 'utilities', 'household', 'entertainment', 'shopping', 'health', 'gifts', 'other'];
const label = (category: string) => category.charAt(0).toUpperCase() + category.slice(1);
const monthLabel = (month: string) => new Date(`${month}-01T12:00:00`).toLocaleDateString([], { month: 'long', year: 'numeric' });

type DateRange = 'all' | 'month' | '30d' | '90d' | 'year';
const RANGES: { value: DateRange; label: string }[] = [
  { value: 'all', label: 'All time' }, { value: 'month', label: 'This month' }, { value: '30d', label: '30 days' }, { value: '90d', label: '3 months' }, { value: 'year', label: 'This year' },
];
function rangeOf(range: DateRange): Pick<ActivityFilters, 'date_from'> {
  const now = new Date();
  const from = { all: null, month: new Date(now.getFullYear(), now.getMonth(), 1), '30d': new Date(now.getTime() - 30 * 86400e3), '90d': new Date(now.getTime() - 90 * 86400e3), year: new Date(now.getFullYear(), 0, 1) }[range];
  return from ? { date_from: from.toISOString() } : {};
}

const netColor = (net: number) => (net > 0 ? colors.success700 : net < 0 ? colors.danger600 : colors.muted500);
const netText = (net: number, currency: string, you = false) =>
  net > 0 ? `${you ? 'You get back' : 'Gets back'} ${formatMinor(net, currency)}` : net < 0 ? `${you ? 'You owe' : 'Owes'} ${formatMinor(-net, currency)}` : 'Settled';

const ChatExpensesScreen: React.FC<NativeStackScreenProps<AppStackParams, 'ChatExpenses'>> = ({ route, navigation }) => {
  const { conversationId } = route.params;
  const me = useAuth((s) => s.user)!;
  const [tab, setTab] = useState<Tab>('you');
  const [balances, setBalances] = useState<Balances | null>(null);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [version, setVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [settle, setSettle] = useState<Settle | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([expenseService.balances(conversationId), expenseService.summary(conversationId)]);
      setBalances(b);
      setSummary(s);
      setVersion((v) => v + 1);
    } catch (e) {
      showAlert("Couldn't load expenses", errorMessage(e));
    }
  }, [conversationId]);

  useEffect(() => { load(); }, [load]);
  useExpenseChanges(conversationId, load);

  const hasExpenses = !!summary?.currencies.length;
  const download = useCallback(async () => {
    setDownloading(true);
    try {
      const file = await expenseService.saveExcel(conversationId);
      if (Platform.OS === 'android') showAlert('Saved to Downloads', file);
    } catch (e) {
      showAlert("Couldn't download", errorMessage(e));
    } finally {
      setDownloading(false);
    }
  }, [conversationId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtons}>
          {hasExpenses && (downloading ? <ActivityIndicator color={colors.primary700} /> : (
            <Pressable onPress={download} hitSlop={8} accessibilityLabel="Download as Excel"><Download size={22} color={colors.primary700} /></Pressable>
          ))}
          <Pressable onPress={() => navigation.navigate('AddExpense', { conversationId })} hitSlop={8} accessibilityLabel="Add expense">
            <Plus size={24} color={colors.primary700} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, conversationId, hasExpenses, downloading, download]);

  const users: Users = summary?.users || balances?.users || {};
  const name = (id: string) => (id === me.id ? 'You' : users[id]?.name || users[id]?.username || 'Someone');

  const record = async () => {
    if (!settle) return;
    const minor = parseMajor(settle.amount, settle.currency);
    if (!minor || minor <= 0) { showAlert('Enter the amount paid'); return; }
    setSaving(true);
    try {
      await expenseService.settle(conversationId, { from_user: settle.from, to_user: settle.to, currency: settle.currency, amount: settle.amount });
      setSettle(null);
      load();
    } catch (e) {
      showAlert("Couldn't record the payment", errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!balances || !summary) return <View style={styles.center}><ActivityIndicator color={colors.primary700} /></View>;
  const props = { summary, balances, me: me.id, name, users, onSettle: setSettle, conversationId };

  return (
    <View style={styles.container}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((t) => (
          <Pressable key={t.value} onPress={() => setTab(t.value)} style={[styles.tab, tab === t.value && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === t.value }}>
            <Text style={[styles.tabText, tab === t.value && styles.tabTextOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'history' ? (
        <HistoryTab conversationId={conversationId} me={me.id} name={name} users={users} version={version}
          onOpen={(id) => navigation.navigate('ExpenseDetail', { expenseId: id })} onChanged={load} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
          {!hasExpenses ? (
            <Text style={styles.empty}>No expenses yet. Tap + to add one, or scan a receipt from the chat.</Text>
          ) : tab === 'you' ? <YouTab {...props} /> : tab === 'balances' ? <BalancesTab {...props} /> : <SummaryTab summary={summary} name={name} users={users} />}
        </ScrollView>
      )}

      <Modal visible={!!settle} transparent animationType="fade" onRequestClose={() => setSettle(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSettle(null)}>
          {settle && (
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.sheetTitle}>Settle up</Text>
              <Text style={styles.sheetText}>
                Record that {name(settle.from)} paid {settle.to === me.id ? 'you' : name(settle.to)}. Papyris doesn't move money: pay however you like, then record it here.
              </Text>
              <TextInput value={settle.amount} onChangeText={(amount) => setSettle({ ...settle, amount })} keyboardType="decimal-pad" style={styles.amount} accessibilityLabel="Amount paid" />
              <Button title="Record payment" onPress={record} loading={saving} />
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </View>
  );
};

interface TabProps { summary: ExpenseSummary; balances: Balances; me: string; name: (id: string) => string; users: Users; onSettle: (s: Settle) => void; conversationId: string }

/** "Pay": choose one of the payee's payment apps; it opens with the amount (copied first for Revolut). */
function pay(handles: PayHandles | undefined, minor: number, currency: string, payee: string) {
  const options = payOptions(handles, minor, currency, decimalsFor(currency), payee, 'Papyris');
  const open = (o: (typeof options)[number]) => {
    if (o.copyAmount) Clipboard.setString(toMajorString(minor, currency));
    Linking.openURL(o.url).catch(() => showAlert(`Couldn't open ${o.label}`, 'Is the app installed?'));
  };
  if (options.length === 1) {
    open(options[0]);
    return;
  }
  showAlert(`Pay ${payee} ${formatMinor(minor, currency)}`, 'Then come back and tap Settle to record it.', [
    ...options.map((o) => ({ text: o.copyAmount ? `${o.label} (amount copied)` : o.label, onPress: () => open(o) })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}

const RemindButton: React.FC<{ conversationId: string; userId: string; currency: string }> = ({ conversationId, userId, currency }) => {
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const remind = async () => {
    setState('busy');
    try {
      await expenseService.remind(conversationId, userId, currency);
      setState('sent');
    } catch (e) {
      setState('idle');
      showAlert("Couldn't send the reminder", errorMessage(e));
    }
  };
  return (
    <Pressable onPress={remind} disabled={state !== 'idle'} style={[styles.outlineButton, state !== 'idle' && { opacity: 0.5 }]} accessibilityLabel="Remind them">
      <BellRing size={13} color={colors.muted700} />
      <Text style={styles.outlineText}>{state === 'sent' ? 'Reminded' : 'Remind'}</Text>
    </Pressable>
  );
};

const Stat: React.FC<{ title: string; minor: number; currency: string }> = ({ title, minor, currency }) => (
  <View style={styles.stat}><Text style={styles.statLabel}>{title}</Text><Text style={styles.statValue}>{formatMinor(minor, currency)}</Text></View>
);

// ---------------------------------------------------------------- You

const YouTab: React.FC<TabProps> = ({ summary, balances, me, name, users, onSettle, conversationId }) => (
  <>
    {summary.currencies.map((c) => {
      const debts = balances.currencies.find((b) => b.currency === c.currency)?.debts.filter((d) => d.from_user === me || d.to_user === me) || [];
      return (
        <View key={c.currency} style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.currency}>{c.currency}</Text>
            <Text style={[styles.net, { color: netColor(c.me.net_minor) }]}>{netText(c.me.net_minor, c.currency, true)}</Text>
          </View>
          <View style={styles.stats}>
            <Stat title="You paid" minor={c.me.paid_minor} currency={c.currency} />
            <Stat title="Your share" minor={c.me.share_minor} currency={c.currency} />
            <Stat title="You paid back" minor={c.me.sent_minor} currency={c.currency} />
            <Stat title="Paid back to you" minor={c.me.received_minor} currency={c.currency} />
          </View>
          {debts.length === 0 ? (
            <View style={styles.row}><CheckCircle2 size={16} color={colors.success700} /><Text style={styles.settledText}>Nothing to settle</Text></View>
          ) : debts.map((d) => {
            const other = d.from_user === me ? d.to_user : d.from_user;
            const iOwe = d.from_user === me;
            return (
              <View key={`${d.from_user}-${d.to_user}`} style={styles.debtBlock}>
              <View style={styles.row}>
                <Avatar uri={users[other]?.avatar} name={users[other]?.name || users[other]?.username || 'Someone'} size={28} />
                <Text style={styles.rowText} numberOfLines={2}>{iOwe ? `You owe ${name(other)}` : `${name(other)} owes you`}</Text>
                <Text style={[styles.rowAmount, { color: iOwe ? colors.danger600 : colors.success700 }]}>{formatMinor(d.amount_minor, c.currency)}</Text>
              </View>
              <View style={styles.actions}>
                {iOwe ? (
                  payOptions(users[other]?.pay, d.amount_minor, c.currency, decimalsFor(c.currency), name(other), '').length > 0 && (
                    <Pressable onPress={() => pay(users[other]?.pay, d.amount_minor, c.currency, users[other]?.name || users[other]?.username || 'them')} style={styles.payButton} accessibilityLabel="Pay">
                      <Wallet size={13} color={colors.white} /><Text style={styles.payText}>Pay</Text>
                    </Pressable>
                  )
                ) : <RemindButton conversationId={conversationId} userId={other} currency={c.currency} />}
                <Pressable onPress={() => onSettle({ from: d.from_user, to: d.to_user, currency: c.currency, amount: toMajorString(d.amount_minor, c.currency) })} style={styles.smallButton}>
                  <Text style={styles.smallButtonText}>{iOwe ? 'Settle' : 'Mark paid'}</Text>
                </Pressable>
              </View>
              </View>
            );
          })}
        </View>
      );
    })}
    <Text style={styles.note}>Only your own amounts are shown here. See Balances for everyone.</Text>
  </>
);

// ---------------------------------------------------------------- Balances

const BalancesTab: React.FC<TabProps> = ({ summary, balances, me, name, users, onSettle }) => (
  <>
    {summary.currencies.map((c) => {
      const debts = balances.currencies.find((b) => b.currency === c.currency)?.debts || [];
      return (
        <View key={c.currency} style={styles.card}>
          <Text style={styles.cardTitle}>{c.currency} · each member</Text>
          {c.members.map((m) => (
            <View key={m.user_id} style={styles.row}>
              <Avatar uri={users[m.user_id]?.avatar} name={users[m.user_id]?.name || users[m.user_id]?.username || 'Someone'} size={30} />
              <View style={styles.flex}>
                <Text style={[styles.memberName, m.user_id === me && styles.bold]} numberOfLines={1}>{name(m.user_id)}</Text>
                <Text style={styles.sub}>Paid {formatMinor(m.paid_minor, c.currency)} · share {formatMinor(m.share_minor, c.currency)}</Text>
              </View>
              <Text style={[styles.rowAmount, { color: netColor(m.net_minor) }]}>{netText(m.net_minor, c.currency)}</Text>
            </View>
          ))}
          <View style={[styles.row, { marginTop: space(2) }]}><ArrowRightLeft size={16} color={colors.muted500} /><Text style={styles.cardTitle}>To settle up</Text></View>
          {debts.length === 0 ? (
            <View style={styles.row}><CheckCircle2 size={16} color={colors.success700} /><Text style={styles.settledText}>Everyone is settled up</Text></View>
          ) : debts.map((d) => (
            <View key={`${d.from_user}-${d.to_user}`} style={styles.row}>
              <Text style={styles.rowText} numberOfLines={2}>{name(d.from_user)} {d.from_user === me ? 'pay' : 'pays'} {d.to_user === me ? 'you' : name(d.to_user)}</Text>
              <Text style={styles.rowAmount}>{formatMinor(d.amount_minor, c.currency)}</Text>
              <Pressable onPress={() => onSettle({ from: d.from_user, to: d.to_user, currency: c.currency, amount: toMajorString(d.amount_minor, c.currency) })} style={styles.smallButton}>
                <Text style={styles.smallButtonText}>Record</Text>
              </Pressable>
            </View>
          ))}
        </View>
      );
    })}
    <Text style={styles.note}>{balances.simplified ? 'Payments are simplified to the fewest needed.' : 'Showing who owes whom directly.'} Change this in the chat's info.</Text>
  </>
);

// ---------------------------------------------------------------- Summary

const Bar: React.FC<{ part: number; whole: number }> = ({ part, whole }) => (
  <View style={styles.barTrack}><View style={[styles.barFill, { width: `${whole ? Math.max(2, (part / whole) * 100) : 0}%` }]} /></View>
);

const SummaryTab: React.FC<{ summary: ExpenseSummary; name: (id: string) => string; users: Users }> = ({ summary, name, users }) => (
  <>
    {summary.currencies.map((c: CurrencySummary) => {
      const topPaid = Math.max(...c.members.map((m) => Math.max(m.paid_minor, m.share_minor)), 1);
      const topMonth = Math.max(...c.by_month.map((m) => m.total_minor), 1);
      return (
        <View key={c.currency} style={styles.card}>
          <Text style={styles.sub}>Total spent · {c.currency}</Text>
          <Text style={styles.total}>{formatMinor(c.total_minor, c.currency)}</Text>
          <Text style={styles.sub}>{c.count} expense{c.count === 1 ? '' : 's'}</Text>

          <Text style={styles.blockTitle}>By category</Text>
          {c.by_category.map((cat) => (
            <View key={cat.category} style={styles.row}>
              <CategoryIcon category={cat.category} size={30} />
              <View style={styles.flex}>
                <View style={styles.spread}>
                  <Text style={styles.memberName}>{label(cat.category)} <Text style={styles.sub}>· {cat.count}</Text></Text>
                  <Text style={styles.rowAmount}>{formatMinor(cat.total_minor, c.currency)} <Text style={styles.sub}>{Math.round((cat.total_minor / c.total_minor) * 100)}%</Text></Text>
                </View>
                <Bar part={cat.total_minor} whole={c.total_minor} />
              </View>
            </View>
          ))}

          <Text style={styles.blockTitle}>By member <Text style={styles.sub}>paid · share</Text></Text>
          {c.members.filter((m) => m.paid_minor || m.share_minor).map((m) => (
            <View key={m.user_id} style={styles.row}>
              <Avatar uri={users[m.user_id]?.avatar} name={users[m.user_id]?.name || users[m.user_id]?.username || 'Someone'} size={30} />
              <View style={styles.flex}>
                <View style={styles.spread}>
                  <Text style={styles.memberName} numberOfLines={1}>{name(m.user_id)}</Text>
                  <Text style={styles.rowAmount}>{formatMinor(m.paid_minor, c.currency)} <Text style={styles.sub}>· {formatMinor(m.share_minor, c.currency)}</Text></Text>
                </View>
                <Bar part={m.paid_minor} whole={topPaid} />
              </View>
            </View>
          ))}

          <Text style={styles.blockTitle}>By month</Text>
          {c.by_month.map((m) => (
            <View key={m.month} style={styles.flexGap}>
              <View style={styles.spread}><Text style={styles.memberName}>{monthLabel(m.month)}</Text><Text style={styles.rowAmount}>{formatMinor(m.total_minor, c.currency)}</Text></View>
              <Bar part={m.total_minor} whole={topMonth} />
            </View>
          ))}
        </View>
      );
    })}
  </>
);

// ---------------------------------------------------------------- History

const Chip: React.FC<{ text: string; on?: boolean; onPress: () => void; menu?: boolean }> = ({ text, on, onPress, menu }) => (
  <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]} accessibilityState={{ selected: !!on }}>
    <Text style={[styles.chipText, on && styles.chipTextOn]}>{text}</Text>
    {menu && <ChevronDown size={14} color={on ? colors.primary800 : colors.muted500} />}
  </Pressable>
);

const Picker: React.FC<{ title: string; options: { value: string; label: string }[]; onPick: (v: string) => void; onClose: () => void }> = ({ title, options, onPick, onClose }) => (
  <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
        <Text style={styles.sheetTitle}>{title}</Text>
        <ScrollView style={{ maxHeight: 420 }}>
          {options.map((o) => (
            <Pressable key={o.value} onPress={() => onPick(o.value)} style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.muted50 }]}>
              <Text style={styles.optionText}>{o.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Pressable>
    </Pressable>
  </Modal>
);

const HistoryTab: React.FC<{
  conversationId: string; me: string; name: (id: string) => string; users: Users; version: number;
  onOpen: (expenseId: string) => void; onChanged: () => void;
}> = ({ conversationId, me, name, users, version, onOpen, onChanged }) => {
  const [range, setRange] = useState<DateRange>('all');
  const [category, setCategory] = useState('');
  const [member, setMember] = useState('');
  const [kind, setKind] = useState<'' | 'expense' | 'settlement'>('');
  const [picking, setPicking] = useState<'category' | 'member' | null>(null);
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const filters = useMemo<ActivityFilters>(() => ({ ...rangeOf(range), ...(category ? { category } : {}), ...(member ? { member } : {}), ...(kind ? { kind } : {}) }),
    [range, category, member, kind]);
  const load = useCallback(() => expenseService.activity(conversationId, filters).then((r) => setItems(r.items)).catch((e) => showAlert("Couldn't load the history", errorMessage(e))),
    [conversationId, filters]);
  useEffect(() => { load(); }, [load, version]);

  const removePayment = (id: string) => showAlert('Remove this payment?', 'Balances go back to how they were before it.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => { expenseService.removeSettlement(id).then(onChanged).catch((e) => showAlert("Couldn't remove it", errorMessage(e))); } },
  ]);
  const filtered = range !== 'all' || !!category || !!member || !!kind;

  return (
    <ScrollView contentContainerStyle={styles.historyContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {RANGES.map((r) => <Chip key={r.value} text={r.label} on={range === r.value} onPress={() => setRange(r.value)} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip text={category ? label(category) : 'Category'} on={!!category} menu onPress={() => setPicking('category')} />
        <Chip text={member ? name(member) : 'Member'} on={!!member} menu onPress={() => setPicking('member')} />
        <Chip text="Expenses" on={kind === 'expense'} onPress={() => setKind(kind === 'expense' ? '' : 'expense')} />
        <Chip text="Payments" on={kind === 'settlement'} onPress={() => setKind(kind === 'settlement' ? '' : 'settlement')} />
        {filtered && <Chip text="Clear" onPress={() => { setRange('all'); setCategory(''); setMember(''); setKind(''); }} />}
      </ScrollView>

      {!items ? <ActivityIndicator style={{ marginTop: space(8) }} color={colors.primary700} /> : items.length === 0 ? (
        <Text style={styles.empty}>{filtered ? 'Nothing matches these filters.' : 'No expenses or payments yet.'}</Text>
      ) : items.map((it) => {
        const when = new Date(it.at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
        if (it.kind === 'settlement') {
          return (
            <Pressable key={`s-${it.id}`} onLongPress={it.created_by === me ? () => removePayment(it.id) : undefined} style={styles.item}>
              <View style={styles.payIcon}><ArrowRightLeft size={16} color={colors.success700} /></View>
              <View style={styles.flex}>
                <Text style={styles.itemTitle} numberOfLines={1}>{name(it.from_user)} paid {it.to_user === me ? 'you' : name(it.to_user)}</Text>
                <Text style={styles.sub}>Payment · {when}{it.note ? ` · ${it.note}` : ''}{it.created_by === me ? ' · hold to remove' : ''}</Text>
              </View>
              <Text style={styles.rowAmount}>{formatMinor(it.amount_minor, it.currency)}</Text>
            </Pressable>
          );
        }
        const net = (it.payers.find((p) => p.user_id === me)?.amount_minor || 0) - (it.shares.find((s) => s.user_id === me)?.amount_minor || 0);
        const payer = it.payers.length > 1 ? `${it.payers.length} people` : name(it.payers[0]?.user_id || '');
        return (
          <Pressable key={`e-${it.id}`} onPress={() => onOpen(it.id)} style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.muted50 }]}>
            <CategoryIcon category={it.category} size={34} />
            <View style={styles.flex}>
              <View style={styles.titleRow}>
                <Text style={styles.itemTitle} numberOfLines={1}>{it.description}</Text>
                {it.locked && <Lock size={13} color={colors.muted400} />}
                {it.source === 'receipt' && <ScrollText size={13} color={colors.primary500} />}
              </View>
              <Text style={styles.sub}>{payer} paid {formatMinor(it.total_minor, it.currency)} · {label(it.category)} · {when}</Text>
            </View>
            <Text style={[styles.rowAmount, { color: netColor(net) }]}>{net === 0 ? '—' : `${net > 0 ? '+' : '−'}${formatMinor(Math.abs(net), it.currency)}`}</Text>
          </Pressable>
        );
      })}

      {picking && (
        <Picker
          title={picking === 'category' ? 'Category' : 'Member'}
          options={picking === 'category'
            ? [{ value: '', label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c, label: label(c) }))]
            : [{ value: '', label: 'Everyone' }, ...Object.keys(users).map((id) => ({ value: id, label: name(id) }))]}
          onPick={(v) => { if (picking === 'category') setCategory(v); else setMember(v); setPicking(null); }}
          onClose={() => setPicking(null)}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: space(4) },
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: space(4), paddingBottom: space(10), gap: space(3) },
  historyContent: { paddingBottom: space(10) },
  flex: { flex: 1 },
  flexGap: { gap: 4 },
  tabs: { flexDirection: 'row', margin: space(4), marginBottom: 0, padding: 3, borderRadius: radius.md, backgroundColor: colors.muted100 },
  tab: { flex: 1, paddingVertical: space(2), borderRadius: radius.sm, alignItems: 'center' },
  tabOn: { backgroundColor: colors.white },
  tabText: { fontSize: 14, color: colors.muted600 },
  tabTextOn: { color: colors.primary700, fontWeight: '700' },
  card: { padding: space(4), borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.muted200, gap: space(2.5) },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { fontSize: 13, fontWeight: '600', color: colors.muted500 },
  currency: { fontSize: 13, color: colors.muted500 },
  net: { fontSize: 16, fontWeight: '700' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  stat: { flexBasis: '47%', flexGrow: 1, padding: space(3), borderRadius: radius.md, backgroundColor: colors.muted50 },
  statLabel: { fontSize: 12, color: colors.muted500 },
  statValue: { fontSize: 16, fontWeight: '700', color: colors.muted900, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2.5) },
  rowText: { flex: 1, fontSize: 14, color: colors.muted700 },
  rowAmount: { fontSize: 14, fontWeight: '600', color: colors.muted900 },
  settledText: { color: colors.success700, fontWeight: '600', fontSize: 14 },
  memberName: { fontSize: 14, color: colors.muted900 },
  bold: { fontWeight: '700' },
  sub: { fontSize: 12, color: colors.muted500, fontWeight: '400' },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space(2) },
  debtBlock: { gap: space(1.5) },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space(2) },
  payButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: radius.sm, backgroundColor: colors.primary700 },
  payText: { fontSize: 13, fontWeight: '700', color: colors.white },
  outlineButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: radius.sm, borderWidth: 1, borderColor: colors.muted200 },
  outlineText: { fontSize: 13, fontWeight: '600', color: colors.muted700 },
  smallButton: { paddingHorizontal: space(2.5), paddingVertical: space(1), borderRadius: radius.sm, backgroundColor: colors.primary50 },
  smallButtonText: { fontSize: 13, fontWeight: '600', color: colors.primary700 },
  note: { fontSize: 12, color: colors.muted400, paddingHorizontal: space(1) },
  total: { fontSize: 30, fontWeight: '800', color: colors.muted900 },
  blockTitle: { marginTop: space(3), fontSize: 15, fontWeight: '700', color: colors.muted900 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.muted100, overflow: 'hidden', marginTop: 4 },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary500 },
  empty: { textAlign: 'center', color: colors.muted500, marginTop: space(8), paddingHorizontal: space(6) },
  chips: { flexDirection: 'row', gap: space(2), paddingHorizontal: space(4), paddingTop: space(3) },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: radius.full, borderWidth: 1, borderColor: colors.muted200, backgroundColor: colors.white },
  chipOn: { borderColor: colors.primary600, backgroundColor: colors.primary50 },
  chipText: { fontSize: 13, color: colors.muted700 },
  chipTextOn: { color: colors.primary800, fontWeight: '600' },
  item: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(3), backgroundColor: colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.muted200, marginTop: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  itemTitle: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: colors.muted900 },
  payIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success50 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: space(5), paddingBottom: space(10), gap: space(3) },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.muted900 },
  sheetText: { fontSize: 14, color: colors.muted600 },
  amount: { height: 52, borderWidth: 1, borderColor: colors.muted300, borderRadius: radius.md, paddingHorizontal: space(3), fontSize: 20, fontWeight: '600', color: colors.muted900 },
  option: { paddingVertical: space(3), paddingHorizontal: space(2), borderRadius: radius.sm },
  optionText: { fontSize: 15, color: colors.muted900 },
});

export default ChatExpensesScreen;
