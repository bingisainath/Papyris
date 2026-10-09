// src/screens/expenses/ExpensesHomeScreen.tsx
// Expenses tab: your money across every chat (Overall), then pick a chat to see its balances and expenses.
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight, Wallet } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar from '../../components/Avatar';
import { Empty } from '../../components/ui';
import { useChat } from '../../store/chat';
import { expenseService } from '../../api/expenses';
import type { ExpensesOverview } from '../../api/expenses';
import { formatMinor } from '../../utils/money';
import { colors, radius, space } from '../../theme';
import type { AppStackParams } from '../../navigation/types';

const ExpensesHomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParams>>();
  const { conversations, loadConversations } = useChat();
  // Groups by default; a direct chat shows up once it has expenses (or with "Show all chats")
  const [withExpenses, setWithExpenses] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [overview, setOverview] = useState<ExpensesOverview | null>(null);
  const [openPerson, setOpenPerson] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    loadConversations().catch(() => undefined);
    expenseService.overview().then(setOverview).catch(() => undefined);
    expenseService.conversationsWithExpenses().then((ids) => setWithExpenses(new Set(ids))).catch(() => undefined);
  }, [loadConversations]));
  const list = conversations
    .filter((c) => showAll || c.isGroup || withExpenses.has(c.id))
    .sort((a, b) => new Date(b.lastMessageTime || 0).getTime() - new Date(a.lastMessageTime || 0).getTime());
  const hidden = conversations.length - list.length;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Expenses</Text>
      <FlatList
        data={list}
        keyExtractor={(c) => c.id}
        contentContainerStyle={!list.length && { flexGrow: 1 }}
        ListHeaderComponent={overview ? (
          <View style={styles.overall} accessibilityLabel="Overall">
            <Text style={styles.overallTitle}>OVERALL</Text>
            {overview.currencies.length === 0 ? (
              <Text style={styles.overallSub}>You're all settled up.</Text>
            ) : overview.currencies.map((c) => (
              <View key={c.currency} style={{ marginTop: space(1.5) }}>
                <Text style={[styles.overallNet, { color: c.net_minor > 0 ? colors.success700 : c.net_minor < 0 ? colors.danger600 : colors.muted700 }]}>
                  {c.net_minor > 0 ? "You're owed " : c.net_minor < 0 ? 'You owe ' : 'Settled · '}{formatMinor(Math.abs(c.net_minor), c.currency)}
                </Text>
                <Text style={styles.overallSub}>Owed to you {formatMinor(c.owed_minor, c.currency)} · you owe {formatMinor(c.owe_minor, c.currency)}</Text>
              </View>
            ))}
            {overview.people.map((p) => {
              const key = `${p.user_id}-${p.currency}`;
              const u = overview.users[p.user_id];
              const who = u?.name || u?.username || 'Someone';
              return (
                <View key={key}>
                  <Pressable onPress={() => setOpenPerson(openPerson === key ? null : key)} style={styles.person} accessibilityState={{ expanded: openPerson === key }}>
                    <Avatar uri={u?.avatar} name={who} size={28} />
                    <Text style={styles.personName} numberOfLines={1}>{who}</Text>
                    <Text style={[styles.personAmount, { color: p.net_minor > 0 ? colors.success700 : colors.danger600 }]}>
                      {p.net_minor > 0 ? 'owes you ' : 'you owe '}{formatMinor(Math.abs(p.net_minor), p.currency)}
                    </Text>
                  </Pressable>
                  {openPerson === key && p.chats.map((ch) => (
                    <Pressable key={ch.conversation_id} onPress={() => navigation.navigate('ChatExpenses', { conversationId: ch.conversation_id })} style={styles.chatLine}>
                      <Text style={styles.chatLineText} numberOfLines={1}>{ch.is_group ? ch.title || conversations.find((c) => c.id === ch.conversation_id)?.name || 'Group' : 'Direct chat'}</Text>
                      <Text style={styles.chatLineText}>{ch.amount_minor > 0 ? '+' : '−'}{formatMinor(Math.abs(ch.amount_minor), p.currency)}</Text>
                    </Pressable>
                  ))}
                </View>
              );
            })}
          </View>
        ) : null}
        ListEmptyComponent={<Empty icon={Wallet} title="No groups yet" text="Create a group to share expenses" />}
        ListFooterComponent={hidden > 0 || showAll ? (
          <Pressable onPress={() => setShowAll((v) => !v)} style={styles.more} hitSlop={8}>
            <Text style={styles.moreText}>{showAll ? 'Show groups only' : `Show all chats (${hidden} direct)`}</Text>
          </Pressable>
        ) : null}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('ChatExpenses', { conversationId: item.id })} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.muted50 }]}>
            <Avatar uri={item.avatar} name={item.name} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.kind}>{item.isGroup ? 'Group' : 'Direct message'}</Text>
            </View>
            <ChevronRight size={18} color={colors.muted400} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  title: { paddingHorizontal: space(4), paddingTop: space(2), fontSize: 26, fontWeight: '700', color: colors.muted900 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(3) },
  name: { fontSize: 16, fontWeight: '500', color: colors.muted900 },
  kind: { fontSize: 13, color: colors.muted500 },
  more: { padding: space(4), alignItems: 'center' },
  overall: { margin: space(4), padding: space(4), borderRadius: radius.lg, backgroundColor: colors.primary50, borderWidth: 1, borderColor: colors.primary100 },
  overallTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: colors.primary800 },
  overallNet: { fontSize: 20, fontWeight: '800' },
  overallSub: { fontSize: 12, color: colors.muted600, marginTop: 2 },
  person: { flexDirection: 'row', alignItems: 'center', gap: space(2.5), paddingTop: space(3) },
  personName: { flex: 1, fontSize: 14, color: colors.muted900 },
  personAmount: { fontSize: 14, fontWeight: '700' },
  chatLine: { flexDirection: 'row', justifyContent: 'space-between', gap: space(3), paddingLeft: space(10), paddingTop: space(1.5) },
  chatLineText: { fontSize: 12, color: colors.muted600 },
  moreText: { fontSize: 14, fontWeight: '600', color: colors.primary700 },
});

export default ExpensesHomeScreen;
