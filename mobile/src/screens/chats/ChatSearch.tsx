// src/screens/chats/ChatSearch.tsx
// Search inside one chat (header → magnifier). Encrypted messages are searched on this phone.
import React, { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Lock } from 'lucide-react-native';
import { searchMessages } from '../../services/messageSearch';
import type { SearchHit } from '../../services/messageSearch';
import { listTime } from '../../utils/time';
import { colors, radius, space } from '../../theme';

const ChatSearch: React.FC<{ conversationId: string; currentUserId: string; onPick: (messageId: string) => void; onClose: () => void }> = ({
  conversationId, currentUserId, onPick, onClose,
}) => {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setHits(null); return; }
    let alive = true;
    const timer = setTimeout(() => {
      searchMessages(q, conversationId).then((r) => { if (alive) setHits(r); }).catch(() => { if (alive) setHits([]); });
    }, 250);
    return () => { alive = false; clearTimeout(timer); };
  }, [query, conversationId]);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.bar}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close search"><ArrowLeft size={22} color={colors.muted700} /></Pressable>
          <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search messages in this chat"
            placeholderTextColor={colors.muted400} style={styles.input} returnKeyType="search" />
        </View>
        <FlatList
          data={hits || []}
          keyExtractor={(h) => h.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={hits ? <Text style={styles.empty}>No messages match.</Text> : <Text style={styles.empty}>Type at least 2 letters.</Text>}
          renderItem={({ item: h }) => (
            <Pressable onPress={() => onPick(h.id)} style={({ pressed }) => [styles.hit, pressed && { backgroundColor: colors.muted50 }]}>
              <View style={styles.top}>
                <Text style={styles.sender}>{h.senderId === currentUserId ? 'You' : h.senderName || ''}</Text>
                <Text style={styles.time}>{listTime(h.timestamp)}</Text>
              </View>
              <View style={styles.textRow}>
                {h.encrypted && <Lock size={12} color={colors.muted400} />}
                <Text style={styles.text} numberOfLines={3}>{h.text}</Text>
              </View>
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.muted200 },
  input: { flex: 1, height: 42, paddingHorizontal: space(3), borderRadius: radius.md, backgroundColor: colors.muted100, fontSize: 15, color: colors.muted900 },
  empty: { textAlign: 'center', color: colors.muted500, marginTop: space(8) },
  hit: { paddingHorizontal: space(4), paddingVertical: space(3), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.muted100, gap: 2 },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  sender: { fontSize: 13, fontWeight: '600', color: colors.muted700 },
  time: { fontSize: 12, color: colors.muted400 },
  textRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  text: { flex: 1, fontSize: 15, color: colors.muted900 },
});

export default ChatSearch;
