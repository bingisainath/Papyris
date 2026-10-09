// src/screens/expenses/ExpenseDetailScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Lock, LockOpen, PenLine, Plus, RotateCcw, Trash2 } from 'lucide-react-native';
import { Button } from '../../components/ui';
import { Expense, expenseService, HistoryEntry } from '../../api/expenses';
import { errorMessage } from '../../api/client';
import { mediaUrl } from '../../config';
import { useAuth } from '../../store/auth';
import { formatMinor } from '../../utils/money';
import { colors, radius, space } from '../../theme';
import type { AppStackParams } from '../../navigation/types';
import CategoryIcon from './CategoryIcon';
import { Segmented } from './AddExpenseScreen';
import { memberName, useChatMoney, useExpenseChanges } from './useMembers';
import { showAlert } from '../../components/Dialog';

const ACTION_ICONS = { created: Plus, updated: PenLine, deleted: Trash2, restored: RotateCcw, locked: Lock, unlocked: LockOpen };

const ExpenseDetailScreen: React.FC<NativeStackScreenProps<AppStackParams, 'ExpenseDetail'>> = ({ route, navigation }) => {
  const { expenseId } = route.params;
  const me = useAuth((s) => s.user)!;
  const [expense, setExpense] = useState<Expense | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [tab, setTab] = useState('details');
  const { members } = useChatMoney(expense?.conversation_id);

  const load = useCallback(async () => {
    try {
      const [e, h] = await Promise.all([expenseService.get(expenseId), expenseService.history(expenseId)]);
      setExpense(e);
      setHistory(h);
      navigation.setOptions({ title: e.description });
    } catch (err) {
      showAlert("Couldn't load the expense", errorMessage(err));
      navigation.goBack();
    }
  }, [expenseId, navigation]);

  useEffect(() => navigation.addListener('focus', () => { load(); }), [navigation, load]);
  useExpenseChanges(expense?.conversation_id, load);

  if (!expense) return <View style={styles.center}><ActivityIndicator color={colors.primary700} /></View>;

  const nameOf = (id: string) => (id === me.id ? 'You' : memberName(members.find((m) => m.id === id)));
  const myShare = expense.shares.find((s) => s.user_id === me.id)?.amount_minor || 0;
  const myPaid = expense.payers.find((p) => p.user_id === me.id)?.amount_minor || 0;
  const net = myPaid - myShare;

  const act = async (action: () => Promise<unknown>) => {
    try { await action(); load(); } catch (err) { showAlert('Something went wrong', errorMessage(err)); }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <CategoryIcon category={expense.category} size={60} />
        <Text style={styles.total}>{expense.total_display}</Text>
        <Text style={styles.sub}>
          {expense.spent_at ? new Date(expense.spent_at).toLocaleDateString() : ''}{expense.source === 'receipt' ? ' · from a receipt' : ''}{expense.locked ? ' · locked' : ''}
        </Text>
        {expense.deleted && <Text style={[styles.sub, { color: colors.danger600, fontWeight: '600' }]}>This expense was deleted</Text>}
        <Text style={[styles.net, { color: net > 0 ? colors.success700 : net < 0 ? colors.danger600 : colors.muted500 }]}>
          {net > 0 ? `You get back ${formatMinor(net, expense.currency)}` : net < 0 ? `You owe ${formatMinor(-net, expense.currency)}` : myShare ? 'You’re even on this one' : 'You’re not involved'}
        </Text>
      </View>

      <View style={styles.tabs}>
        <Segmented value={tab} options={[['details', 'Details'], ['history', `History (${history.length})`]]} onChange={setTab} />
      </View>

      {tab === 'details' ? (
        <View style={styles.card}>
          <Text style={styles.section}>Paid by</Text>
          {expense.payers.map((p) => (
            <View key={p.user_id} style={styles.line}><Text style={styles.lineName}>{nameOf(p.user_id)}</Text><Text style={styles.lineAmount}>{formatMinor(p.amount_minor, expense.currency)}</Text></View>
          ))}
          <Text style={[styles.section, { marginTop: space(4) }]}>Split {expense.split_mode === 'itemized' ? 'by item' : expense.split_mode === 'equal' ? 'equally' : `by ${expense.split_mode}`}</Text>
          {expense.shares.map((s) => (
            <View key={s.user_id} style={styles.line}><Text style={styles.lineName}>{nameOf(s.user_id)}</Text><Text style={styles.lineAmount}>{formatMinor(s.amount_minor, expense.currency)}</Text></View>
          ))}
          {expense.receipt_images.length > 0 && (
            <>
              <Text style={[styles.section, { marginTop: space(4) }]}>Receipt</Text>
              <View style={styles.images}>
                {expense.receipt_images.map((src) => <Image key={src} source={{ uri: mediaUrl(src) }} style={styles.receipt} />)}
              </View>
            </>
          )}
        </View>
      ) : (
        <View style={styles.card}>
          {history.map((h) => {
            const Icon = ACTION_ICONS[h.action] || PenLine;
            return (
              <View key={h.id} style={styles.event}>
                <View style={styles.eventIcon}><Icon size={14} color={colors.primary700} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventText}><Text style={{ fontWeight: '700' }}>{h.actor ? (h.actor.id === me.id ? 'You' : h.actor.username) : 'Someone'}</Text> {h.summary}</Text>
                  <Text style={styles.eventTime}>{new Date(h.created_at).toLocaleString()}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.actions}>
        {!expense.deleted && expense.can_edit && (
          <Button title={expense.split_mode === 'itemized' ? 'Edit details' : 'Edit'} icon={PenLine}
            onPress={() => navigation.navigate('AddExpense', { conversationId: expense.conversation_id, expenseId: expense.id })} />
        )}
        {!expense.deleted && expense.can_edit && expense.receipt_id && (
          <Button title="Edit items" variant="secondary" onPress={() => navigation.navigate('ScanReceipt', { conversationId: expense.conversation_id, receiptId: expense.receipt_id! })} />
        )}
        {expense.can_admin && !expense.deleted && (
          <Button title={expense.locked ? 'Unlock' : 'Lock'} variant="secondary" icon={expense.locked ? LockOpen : Lock} onPress={() => act(() => expenseService.lock(expense.id, !expense.locked))} />
        )}
        {expense.can_delete && !expense.locked && (
          <Button title="Delete" variant="danger" icon={Trash2} onPress={() => showAlert('Delete this expense?', 'It can be restored later.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => act(() => expenseService.remove(expense.id)) },
          ])} />
        )}
        {expense.deleted && (expense.can_admin || expense.created_by === me.id) && (
          <Button title="Restore" icon={RotateCcw} onPress={() => act(() => expenseService.restore(expense.id))} />
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: space(4), paddingBottom: space(12), backgroundColor: colors.background },
  hero: { alignItems: 'center', paddingVertical: space(4) },
  total: { marginTop: space(3), fontSize: 32, fontWeight: '700', color: colors.muted900 },
  sub: { marginTop: space(1), fontSize: 13, color: colors.muted500 },
  net: { marginTop: space(2), fontSize: 15, fontWeight: '600' },
  tabs: { alignItems: 'center', marginVertical: space(3) },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: space(4), borderWidth: 1, borderColor: colors.muted200 },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted600, marginBottom: space(1.5) },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space(1.5) },
  lineName: { fontSize: 15, color: colors.muted900 },
  lineAmount: { fontSize: 15, fontWeight: '600', color: colors.muted900 },
  images: { flexDirection: 'row', gap: space(2) },
  receipt: { width: 80, height: 104, borderRadius: radius.sm, backgroundColor: colors.muted100 },
  event: { flexDirection: 'row', gap: space(3), paddingVertical: space(2) },
  eventIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary50, alignItems: 'center', justifyContent: 'center' },
  eventText: { fontSize: 14, color: colors.muted900 },
  eventTime: { fontSize: 12, color: colors.muted500, marginTop: 2 },
  actions: { marginTop: space(4), gap: space(2) },
});

export default ExpenseDetailScreen;
