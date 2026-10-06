// src/screens/expenses/ExpensesHomeScreen.tsx
// Expenses tab: pick a chat to see its balances and expenses.
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
import { colors, space } from '../../theme';
import type { AppStackParams } from '../../navigation/types';

const ExpensesHomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParams>>();
  const { conversations, loadConversations } = useChat();
  // Groups by default; a direct chat shows up once it has expenses (or with "Show all chats")
  const [withExpenses, setWithExpenses] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  useFocusEffect(useCallback(() => {
    loadConversations().catch(() => undefined);
    expenseService.conversationsWithExpenses().then((ids) => setWithExpenses(new Set(ids))).catch(() => undefined);
  }, [loadConversations]));
  const list = conversations
    .filter((c) => showAll || c.isGroup || withExpenses.has(c.id))
    .sort((a, b) => new Date(b.lastMessageTime || 0).getTime() - new Date(a.lastMessageTime || 0).getTime());
  const hidden = conversations.length - list.length;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Expenses</Text>
      <Text style={styles.subtitle}>Split bills in any chat. Scan a receipt or add it by hand.</Text>
      <FlatList
        data={list}
        keyExtractor={(c) => c.id}
        contentContainerStyle={!list.length && { flexGrow: 1 }}
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
  subtitle: { paddingHorizontal: space(4), paddingTop: space(1), paddingBottom: space(3), fontSize: 14, color: colors.muted500 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(3) },
  name: { fontSize: 16, fontWeight: '500', color: colors.muted900 },
  kind: { fontSize: 13, color: colors.muted500 },
  more: { padding: space(4), alignItems: 'center' },
  moreText: { fontSize: 14, fontWeight: '600', color: colors.primary700 },
});

export default ExpensesHomeScreen;
