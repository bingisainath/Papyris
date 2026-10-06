// src/screens/chats/ChatListScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { MessageSquarePlus, MessagesSquare, Pin, Search, UsersRound } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar from '../../components/Avatar';
import { Empty } from '../../components/ui';
import { useAuth } from '../../store/auth';
import { typingNames, useChat } from '../../store/chat';
import type { Conversation } from '../../api/chat';
import { colors, radius, space } from '../../theme';
import { listTime } from '../../utils/time';
import type { AppStackParams } from '../../navigation/types';

type Filter = 'all' | 'direct' | 'groups';

const ChatListScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParams>>();
  const me = useAuth((s) => s.user);
  const { conversations, loaded, online, typing, loadConversations } = useChat();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { loadConversations().catch(() => undefined); }, [loadConversations]));

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const time = (v?: string | null) => (v ? new Date(v).getTime() : 0);
    return conversations
      .filter((c) => (filter === 'all' ? true : filter === 'groups' ? c.isGroup : !c.isGroup))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q))
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || time(b.pinnedAt) - time(a.pinnedAt) || time(b.lastMessageTime) - time(a.lastMessageTime));
  }, [conversations, query, filter]);

  const refresh = async () => {
    setRefreshing(true);
    await loadConversations().catch(() => undefined);
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: Conversation }) => {
    const other = !item.isGroup ? item.members.find((id) => id !== me?.id) : undefined;
    const typers = typingNames(typing, item.id);
    const preview = typers.length ? (item.isGroup ? `${typers[0]} is typing…` : 'typing…') : item.lastMessage || 'No messages yet';
    return (
      <Pressable
        onPress={() => navigation.navigate('Chat', { conversationId: item.id })}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        accessibilityLabel={`${item.name}${item.unreadCount ? `, ${item.unreadCount} unread` : ''}`}
      >
        <Avatar uri={item.avatar} name={item.name} size={50} online={!!other && online.includes(other)} />
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <View style={styles.nameRow}>
              {item.isGroup && <UsersRound size={14} color={colors.muted400} />}
              <Text style={[styles.name, item.unreadCount > 0 && styles.bold]} numberOfLines={1}>{item.name}</Text>
            </View>
            <Text style={[styles.time, item.unreadCount > 0 && { color: colors.primary700 }]}>{listTime(item.lastMessageTime)}</Text>
          </View>
          <View style={styles.rowTop}>
            <Text style={[styles.preview, typers.length > 0 && styles.typing]} numberOfLines={1}>{preview}</Text>
            <View style={styles.badges}>
              {item.isPinned && <Pin size={14} color={colors.muted400} />}
              {item.unreadCount > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text></View>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => navigation.navigate('NewGroup')} hitSlop={8} style={styles.iconButton} accessibilityLabel="New group">
            <UsersRound size={22} color={colors.primary700} />
          </Pressable>
          <Pressable onPress={() => navigation.navigate('NewChat')} hitSlop={8} style={styles.iconButton} accessibilityLabel="New chat">
            <MessageSquarePlus size={22} color={colors.primary700} />
          </Pressable>
        </View>
      </View>
      <View style={styles.search}>
        <Search size={18} color={colors.muted400} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search chats" placeholderTextColor={colors.muted400} style={styles.searchInput} />
      </View>
      <View style={styles.filters}>
        {(['all', 'direct', 'groups'] as Filter[]).map((f) => (
          <Pressable key={f} onPress={() => setFilter(f)} style={[styles.chip, filter === f && styles.chipOn]} accessibilityState={{ selected: filter === f }}>
            <Text style={[styles.chipText, filter === f && styles.chipTextOn]}>{f === 'all' ? 'All' : f === 'direct' ? 'Direct' : 'Groups'}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={list}
        keyExtractor={(c) => c.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary700]} />}
        contentContainerStyle={list.length === 0 && styles.emptyList}
        ListEmptyComponent={loaded ? (
          <Empty icon={MessagesSquare} title={query ? 'No chats found' : 'No conversations yet'} text={query ? undefined : 'Start a chat or create a group'} />
        ) : null}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(4), paddingTop: space(2) },
  title: { fontSize: 26, fontWeight: '700', color: colors.muted900 },
  headerActions: { flexDirection: 'row', gap: space(1) },
  iconButton: { padding: space(2), borderRadius: radius.md },
  search: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginHorizontal: space(4), marginTop: space(3), paddingHorizontal: space(3), borderRadius: radius.md, backgroundColor: colors.muted100 },
  searchInput: { flex: 1, height: 42, fontSize: 15, color: colors.muted900 },
  filters: { flexDirection: 'row', gap: space(2), paddingHorizontal: space(4), paddingVertical: space(3) },
  chip: { paddingHorizontal: space(3.5), paddingVertical: space(1.5), borderRadius: radius.full, backgroundColor: colors.muted100 },
  chipOn: { backgroundColor: colors.primary700 },
  chipText: { fontSize: 13, color: colors.muted700, fontWeight: '500' },
  chipTextOn: { color: colors.white },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(3) },
  pressed: { backgroundColor: colors.muted50 },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(2) },
  nameRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  name: { flexShrink: 1, fontSize: 16, color: colors.muted900, fontWeight: '500' },
  bold: { fontWeight: '700' },
  time: { fontSize: 12, color: colors.muted400 },
  preview: { flex: 1, fontSize: 14, color: colors.muted500 },
  typing: { color: colors.primary700, fontStyle: 'italic' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: colors.primary700, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  emptyList: { flexGrow: 1 },
});

export default ChatListScreen;
