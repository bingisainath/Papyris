// src/screens/expenses/AddExpenseScreen.tsx
// Add or edit an expense by hand (same rules as web/src/components/expenses/ManualExpenseForm.tsx),
// with a shortcut to scan a receipt instead.
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanLine } from 'lucide-react-native';
import Avatar from '../../components/Avatar';
import { Banner, Button } from '../../components/ui';
import { CATEGORIES, Expense, ExpenseInput, expenseService } from '../../api/expenses';
import { errorMessage } from '../../api/client';
import { useKeyboardOffset } from '../../hooks/useKeyboardOffset';
import { useAuth } from '../../store/auth';
import { formatMinor, parseMajor, toMajorString } from '../../utils/money';
import { colors, radius, space } from '../../theme';
import type { AppStackParams } from '../../navigation/types';
import CategoryIcon from './CategoryIcon';
import CurrencyPicker from './CurrencyPicker';
import { memberName, useChatMoney } from './useMembers';
import { showAlert } from '../../components/Dialog';

type Mode = 'equal' | 'exact' | 'percent' | 'shares';
type PayerDraft = { user_id: string; amount: string };

const AddExpenseScreen: React.FC<NativeStackScreenProps<AppStackParams, 'AddExpense'>> = ({ route, navigation }) => {
  const { conversationId, expenseId } = route.params;
  const me = useAuth((s) => s.user)!;
  const { members, settings } = useChatMoney(conversationId);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [ready, setReady] = useState(!expenseId);

  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [currency, setCurrency] = useState('EUR');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<Mode>('equal');
  const [selected, setSelected] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [singlePayer, setSinglePayer] = useState(me.id);
  const [payers, setPayers] = useState<PayerDraft[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyboard = useKeyboardOffset();

  // Editing: load the expense once
  useEffect(() => {
    if (!expenseId) return;
    expenseService.get(expenseId).then((e) => {
      setExpense(e);
      setDescription(e.description);
      setCategory(e.category);
      setCurrency(e.currency);
      setAmount(toMajorString(e.total_minor, e.currency));
      if (e.split_mode !== 'itemized') setMode(e.split_mode as Mode);
      setSelected(e.shares.map((s) => s.user_id));
      setValues(Object.fromEntries(e.shares.map((s) => [s.user_id, e.split_mode === 'exact' ? toMajorString(s.amount_minor, e.currency) : s.split_value || ''])));
      if (e.payers.length > 1) setPayers(e.payers.map((p) => ({ user_id: p.user_id, amount: toMajorString(p.amount_minor, e.currency) })));
      else if (e.payers[0]) setSinglePayer(e.payers[0].user_id);
      setReady(true);
    }).catch((err) => { showAlert("Couldn't load the expense", errorMessage(err)); navigation.goBack(); });
  }, [expenseId, navigation]);

  // New expense: everyone in, chat's currency
  useEffect(() => {
    if (expenseId || !members.length) return;
    setSelected(members.map((m) => m.id));
    if (settings) setCurrency(settings.default_currency);
  }, [members, settings, expenseId]);

  useEffect(() => {
    navigation.setOptions({ title: expenseId ? 'Edit expense' : 'Add expense' });
  }, [navigation, expenseId]);

  const itemized = expense?.split_mode === 'itemized';
  const totalMinor = parseMajor(amount, currency);
  const nameOf = (id: string) => (id === me.id ? 'You' : memberName(members.find((m) => m.id === id)));

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
    if (!itemized && !selected.length) return 'Choose who it’s split between';
    if (!itemized && mode === 'exact' && preview) {
      const sum = Object.values(preview).reduce((a, b) => a + b, 0);
      if (sum !== totalMinor) return `Amounts add up to ${formatMinor(sum, currency)}, not ${formatMinor(totalMinor, currency)}`;
    }
    if (!itemized && mode === 'percent') {
      const sum = selected.reduce((a, id) => a + (Number((values[id] || '').replace(',', '.')) || 0), 0);
      if (Math.abs(sum - 100) > 1e-9) return `Percentages add up to ${sum}%, not 100%`;
    }
    if (payers) {
      const paid = payers.reduce((a, p) => a + (parseMajor(p.amount, currency) || 0), 0);
      if (paid !== totalMinor) return 'What people paid must add up to the total';
    }
    return null;
  })();

  const save = async () => {
    if (problem) { setError(problem); return; }
    const body: ExpenseInput = {
      description: description.trim(),
      category,
      currency,
      amount,
      split_mode: itemized ? 'itemized' : mode,
      splits: selected.map((id) => ({ user_id: id, value: mode === 'equal' ? null : values[id] || '0' })),
      payers: payers ?? [{ user_id: singlePayer, amount }],
      version: expense?.version,
    };
    setSaving(true);
    setError(null);
    try {
      if (expense) await expenseService.update(expense.id, body);
      else await expenseService.create(conversationId, body);
      navigation.goBack();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!ready || !members.length) return <View style={styles.center}><ActivityIndicator color={colors.primary700} /></View>;

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <View ref={keyboard.ref} style={[styles.flex, { paddingBottom: keyboard.offset }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!expense && (
          <Pressable onPress={() => navigation.replace('ScanReceipt', { conversationId })} style={styles.scan}>
            <ScanLine size={22} color={colors.primary700} />
            <View style={styles.flex}>
              <Text style={styles.scanTitle}>Scan a receipt</Text>
              <Text style={styles.hint}>Take a photo and tap who each item is for</Text>
            </View>
          </Pressable>
        )}

        {error && <Banner text={error} />}

        <TextInput value={description} onChangeText={setDescription} placeholder="What was it for?" placeholderTextColor={colors.muted400}
          style={styles.description} maxLength={200} accessibilityLabel="Description" />

        <View style={styles.amountRow}>
          <Pressable onPress={() => !itemized && setPicking(true)} style={styles.currency} accessibilityLabel="Currency">
            <Text style={styles.currencyText}>{currency}</Text>
          </Pressable>
          <TextInput value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor={colors.muted400}
            keyboardType="decimal-pad" style={styles.amount} editable={!itemized} accessibilityLabel="Amount" />
        </View>
        {itemized && <Text style={styles.hint}>From a receipt: change items and who they’re for on the receipt.</Text>}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CATEGORIES.map((c) => (
            <Pressable key={c.id} onPress={() => setCategory(c.id)} style={[styles.chip, category === c.id && styles.chipOn]}>
              <CategoryIcon category={c.id} bare color={category === c.id ? colors.white : colors.primary700} />
              <Text style={[styles.chipText, category === c.id && { color: colors.white }]}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Paid by */}
        <View style={styles.sectionHeader}>
          <Text style={styles.section}>Paid by</Text>
          <Segmented value={payers ? 'several' : 'one'} options={[['one', 'One person'], ['several', 'Several']]}
            onChange={(v) => setPayers(v === 'one' ? null : [{ user_id: singlePayer, amount: totalMinor ? toMajorString(totalMinor, currency) : '' }])} />
        </View>
        {members.map((m) => {
          const entry = payers?.find((p) => p.user_id === m.id);
          const on = payers ? !!entry : singlePayer === m.id;
          return (
            <Pressable key={m.id} style={styles.person} onPress={() => {
              if (!payers) setSinglePayer(m.id);
              else setPayers(entry ? payers.filter((p) => p.user_id !== m.id) : [...payers, { user_id: m.id, amount: '' }]);
            }}>
              <View style={[styles.radio, on && styles.radioOn]} />
              <Avatar uri={m.avatar} name={memberName(m)} size={32} />
              <Text style={styles.personName}>{nameOf(m.id)}</Text>
              {entry && (
                <TextInput value={entry.amount} onChangeText={(v) => setPayers(payers!.map((p) => (p.user_id === m.id ? { ...p, amount: v } : p)))}
                  keyboardType="decimal-pad" placeholder="0.00" style={styles.smallInput} accessibilityLabel={`${nameOf(m.id)} paid`} />
              )}
            </Pressable>
          );
        })}

        {/* Split */}
        {!itemized && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.section}>Split</Text>
              <Segmented value={mode} options={[['equal', 'Equally'], ['exact', 'Amounts'], ['percent', '%'], ['shares', 'Shares']]} onChange={(v) => setMode(v as Mode)} />
            </View>
            {members.map((m) => {
              const on = selected.includes(m.id);
              return (
                <Pressable key={m.id} style={styles.person} onPress={() => toggle(m.id)}>
                  <View style={[styles.checkbox, on && styles.radioOn]} />
                  <Avatar uri={m.avatar} name={memberName(m)} size={32} />
                  <Text style={styles.personName}>{nameOf(m.id)}</Text>
                  {on && mode !== 'equal' && (
                    <TextInput value={values[m.id] || ''} onChangeText={(v) => setValues((s) => ({ ...s, [m.id]: v }))}
                      keyboardType="decimal-pad" placeholder={mode === 'percent' ? '%' : mode === 'shares' ? '1' : '0.00'} style={styles.smallInput} />
                  )}
                  {on && preview && mode !== 'exact' && <Text style={styles.share}>{formatMinor(preview[m.id] || 0, currency)}</Text>}
                </Pressable>
              );
            })}
          </>
        )}

        <Button title={expense ? 'Save changes' : 'Add expense'} onPress={save} loading={saving} style={{ marginTop: space(6) }} />
      </ScrollView>
      <CurrencyPicker visible={picking} value={currency} onClose={() => setPicking(false)} onPick={(c) => { setCurrency(c); setPicking(false); }} />
    </View>
  );
};

export const Segmented: React.FC<{ value: string; options: [string, string][]; onChange: (value: string) => void }> = ({ value, options, onChange }) => (
  <View style={styles.segmented}>
    {options.map(([v, label]) => (
      <Pressable key={v} onPress={() => onChange(v)} style={[styles.segment, value === v && styles.segmentOn]} accessibilityState={{ selected: value === v }}>
        <Text style={[styles.segmentText, value === v && styles.segmentTextOn]}>{label}</Text>
      </Pressable>
    ))}
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  content: { padding: space(4), paddingBottom: space(12), backgroundColor: colors.white },
  scan: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4), marginBottom: space(4), borderRadius: radius.lg, backgroundColor: colors.primary50, borderWidth: 1, borderColor: colors.primary200 },
  scanTitle: { fontSize: 15, fontWeight: '600', color: colors.primary800 },
  hint: { fontSize: 13, color: colors.muted500 },
  description: { height: 50, borderWidth: 1, borderColor: colors.muted300, borderRadius: radius.md, paddingHorizontal: space(3), fontSize: 16, color: colors.muted900 },
  amountRow: { flexDirection: 'row', gap: space(2), marginTop: space(3) },
  currency: { height: 56, minWidth: 72, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.muted300, borderRadius: radius.md },
  currencyText: { fontSize: 16, fontWeight: '700', color: colors.primary700 },
  amount: { flex: 1, height: 56, borderWidth: 1, borderColor: colors.muted300, borderRadius: radius.md, paddingHorizontal: space(3), fontSize: 24, fontWeight: '700', color: colors.muted900, textAlign: 'right' },
  chips: { gap: space(2), paddingVertical: space(4) },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), paddingHorizontal: space(3), paddingVertical: space(2), borderRadius: radius.full, borderWidth: 1, borderColor: colors.muted200 },
  chipOn: { backgroundColor: colors.primary700, borderColor: colors.primary700 },
  chipText: { fontSize: 13, color: colors.muted700 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space(4), marginBottom: space(1) },
  section: { fontSize: 15, fontWeight: '700', color: colors.muted900 },
  person: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(2) },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.muted300 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: colors.muted300 },
  radioOn: { backgroundColor: colors.primary700, borderColor: colors.primary700 },
  personName: { flex: 1, fontSize: 15, color: colors.muted900 },
  smallInput: { width: 90, height: 40, borderWidth: 1, borderColor: colors.muted300, borderRadius: radius.sm, paddingHorizontal: space(2), textAlign: 'right', fontSize: 15, color: colors.muted900 },
  share: { width: 80, textAlign: 'right', fontSize: 14, color: colors.muted600 },
  segmented: { flexDirection: 'row', backgroundColor: colors.muted100, borderRadius: radius.md, padding: 2 },
  segment: { paddingHorizontal: space(2.5), paddingVertical: space(1.5), borderRadius: radius.sm },
  segmentOn: { backgroundColor: colors.white },
  segmentText: { fontSize: 12.5, color: colors.muted600 },
  segmentTextOn: { color: colors.primary800, fontWeight: '700' },
});

export default AddExpenseScreen;
