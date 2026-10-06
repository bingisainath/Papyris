// src/components/UserSearch.tsx
// Search people by username or name (2+ characters), used for new chats, groups and adding members.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, Search } from 'lucide-react-native';
import { chatApi, UserSummary } from '../api/chat';
import { colors, radius, space } from '../theme';
import Avatar from './Avatar';

interface Props {
  selected?: string[];
  exclude?: string[];
  onPick: (user: UserSummary) => void;
  header?: React.ReactElement;
}

const UserSearch: React.FC<Props> = ({ selected = [], exclude = [], onPick, header }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      chatApi.searchUsers(q)
        .then((users) => !cancelled && setResults(users.filter((u) => !exclude.includes(u.id))))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setLoading(false));
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <FlatList
      data={results}
      keyExtractor={(u) => u.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View>
          {header}
          <View style={styles.search}>
            <Search size={18} color={colors.muted400} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search by name or username" placeholderTextColor={colors.muted400}
              autoCapitalize="none" autoCorrect={false} autoFocus style={styles.input} />
            {loading && <ActivityIndicator size="small" color={colors.primary700} />}
          </View>
        </View>
      }
      ListEmptyComponent={<Text style={styles.hint}>{query.trim().length < 2 ? 'Type at least 2 characters' : loading ? '' : 'Nobody found'}</Text>}
      renderItem={({ item }) => {
        const on = selected.includes(item.id);
        return (
          <Pressable onPress={() => onPick(item)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.muted50 }]}>
            <Avatar uri={item.avatar} name={item.name || item.username} size={42} />
            <View style={styles.body}>
              <Text style={styles.name} numberOfLines={1}>{item.name || item.username}</Text>
              <Text style={styles.username}>@{item.username}</Text>
            </View>
            {selected.length > 0 || on ? (
              <View style={[styles.check, on && styles.checkOn]}>{on && <Check size={14} color={colors.white} />}</View>
            ) : null}
          </Pressable>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: space(2), margin: space(4), paddingHorizontal: space(3), borderRadius: radius.md, backgroundColor: colors.muted100 },
  input: { flex: 1, height: 44, fontSize: 15, color: colors.muted900 },
  hint: { textAlign: 'center', color: colors.muted500, marginTop: space(6) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(2.5) },
  body: { flex: 1 },
  name: { fontSize: 16, color: colors.muted900, fontWeight: '500' },
  username: { fontSize: 13, color: colors.muted500 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.muted300, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.primary700, borderColor: colors.primary700 },
});

export default UserSearch;
