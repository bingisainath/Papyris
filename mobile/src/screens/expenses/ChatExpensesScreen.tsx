// src/screens/expenses/ChatExpensesScreen.tsx
// One chat's money: balances per currency, settle up, and its expenses.
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CheckCircle2, Lock, Plus, ScrollText } from 'lucide-react-native';
import Avatar from '../../components/Avatar';
import { Button } from '../../components/ui';
import { Balances, Expense, expenseService } from '../../api/expenses';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../store/auth';
import { formatMinor, parseMajor, toMajorString } from '../../utils/money';
import { colors, radius, space } from '../../theme';
import type { AppStackParams } from '../../navigation/types';
import CategoryIcon from './CategoryIcon';
import { useExpenseChanges } from './useMembers';

type Settle = { from: string; to: string; currency: string; amount: string };

const ChatExpensesScreen: React.FC<NativeStackScreenProps<AppStackParams, 'ChatExpenses'>> = ({ route, navigation }) => {
  const { conversationId } = route.params;
  const me = useAuth((s) => s.user)!;
  const [balances, setBalances] = useState<Balances | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [settle, setSettle] = useState<Settle | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, list] = await Promise.all([expenseService.balances(conversationId), expenseService.list(conversationId)]);
      setBalances(b);
      setExpenses(list);
    } catch (e) {
      Alert.alert("Couldn't load expenses", errorMessage(e));
    }
  }, [conversationId]);

  useEffect(() => { load(); }, [load]);
  useExpenseChanges(conversationId, load);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('AddExpense', { conversationId })} hitSlop={8} accessibilityLabel="Add expense">
          <Plus size={24} color={colors.primary700} />
        </Pressable>
      ),
    });
  }, [navigation, conversationId]);

  const name = (id: string) => (id === me.id ? 'You' : balances?.users[id]?.name || balances?.users[id]?.username || 'Someone');

  const record = async () => {
    if (!settle) return;
    const minor = parseMajor(settle.amount, settle.currency);
    if (!minor || minor <= 0) { Alert.alert('Enter the amount paid'); return; }
    setSaving(true);
    try {
      await expenseService.settle(conversationId, { from_user: settle.from, to_user: settle.to, currency: settle.currency, amount: settle.amount });
      setSettle(null);
      load();
    } catch (e) {
      Alert.alert("Couldn't record the payment", errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!balances) return <View style={styles.center}><ActivityIndicator color={colors.primary700} /></View>;

  const header = (
    <View>
      {balances.currencies.length === 0 ? (
        <View style={styles.settled}><CheckCircle2 size={18} color={colors.success700} /><Text style={styles.settledText}>All settled up</Text></View>
      ) : balances.currencies.map((c) => (
        <View key={c.currency} style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.currency}>{c.currency}</Text>
            <Text style={[styles.net, { color: c.my_net_minor > 0 ? colors.success700 : c.my_net_minor < 0 ? colors.danger600 : colors.muted500 }]}>
              {c.my_net_minor > 0 ? `You are owed ${formatMinor(c.my_net_minor, c.currency)}`
                : c.my_net_minor < 0 ? `You owe ${formatMinor(-c.my_net_minor, c.currency)}` : 'You’re settled'}
            </Text>
          </View>
          {c.debts.map((d) => {
            const mine = d.from_user === me.id || d.to_user === me.id;
            return (
              <View key={`${d.from_user}-${d.to_user}`} style={styles.debt}>
                <Avatar uri={balances.users[d.from_user]?.avatar} name={name(d.from_user)} size={26} />
                <Text style={[styles.debtText, mine && styles.bold]} numberOfLines={2}>
                  {name(d.from_user)} {d.from_user === me.id ? 'owe' : 'owes'} {d.to_user === me.id ? 'you' : name(d.to_user)}
                </Text>
                <Text style={styles.debtAmount}>{d.amount_display}</Text>
                {mine && (
                  <Pressable onPress={() => setSettle({ from: d.from_user, to: d.to_user, currency: c.currency, amount: toMajorString(d.amount_minor, c.currency) })} style={styles.settleButton}>
                    <Text style={styles.settleText}>Settle</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      ))}
      <Text style={styles.sectionTitle}>Expenses</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={expenses}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={<Text style={styles.empty}>No expenses yet. Tap + to add one.</Text>}
        renderItem={({ item: e }) => {
          const net = (e.payers.find((p) => p.user_id === me.id)?.amount_minor || 0) - (e.shares.find((s) => s.user_id === me.id)?.amount_minor || 0);
          const payer = e.payers.length > 1 ? `${e.payers.length} people` : name(e.payers[0]?.user_id || '');
          return (
            <Pressable onPress={() => navigation.navigate('ExpenseDetail', { expenseId: e.id })} style={({ pressed }) => [styles.expense, pressed && { backgroundColor: colors.muted50 }]}>
              <CategoryIcon category={e.category} size={38} />
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.expenseTitle} numberOfLines={1}>{e.description}</Text>
                  {e.locked && <Lock size={13} color={colors.muted400} />}
                  {e.source === 'receipt' && <ScrollText size={13} color={colors.primary500} />}
                </View>
                <Text style={styles.expenseSub}>{payer} paid {e.total_display}</Text>
              </View>
              <Text style={[styles.expenseNet, { color: net > 0 ? colors.success700 : net < 0 ? colors.danger600 : colors.muted400 }]}>
                {net === 0 ? '—' : `${net > 0 ? '+' : '-'}${formatMinor(Math.abs(net), e.currency)}`}
              </Text>
            </Pressable>
          );
        }}
      />

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  settled: { flexDirection: 'row', gap: space(2), alignItems: 'center', justifyContent: 'center', margin: space(4), padding: space(4), borderRadius: radius.lg, backgroundColor: colors.success50 },
  settledText: { color: colors.success700, fontWeight: '600' },
  card: { margin: space(4), marginBottom: 0, padding: space(4), borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.muted200, gap: space(2.5) },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  currency: { fontSize: 13, color: colors.muted500 },
  net: { fontSize: 16, fontWeight: '700' },
  debt: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  debtText: { flex: 1, fontSize: 14, color: colors.muted600 },
  bold: { color: colors.muted900, fontWeight: '600' },
  debtAmount: { fontSize: 14, fontWeight: '600', color: colors.muted900 },
  settleButton: { paddingHorizontal: space(2.5), paddingVertical: space(1), borderRadius: radius.sm, backgroundColor: colors.primary50 },
  settleText: { fontSize: 13, fontWeight: '600', color: colors.primary700 },
  sectionTitle: { paddingHorizontal: space(4), paddingTop: space(5), paddingBottom: space(2), fontSize: 12, fontWeight: '700', color: colors.muted500, textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { textAlign: 'center', color: colors.muted500, marginTop: space(6) },
  expense: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(3), backgroundColor: colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.muted200 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  expenseTitle: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: colors.muted900 },
  expenseSub: { fontSize: 13, color: colors.muted500 },
  expenseNet: { fontSize: 14, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: space(5), paddingBottom: space(10), gap: space(3) },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.muted900 },
  sheetText: { fontSize: 14, color: colors.muted600 },
  amount: { height: 52, borderWidth: 1, borderColor: colors.muted300, borderRadius: radius.md, paddingHorizontal: space(3), fontSize: 20, fontWeight: '600', color: colors.muted900 },
});

export default ChatExpensesScreen;
