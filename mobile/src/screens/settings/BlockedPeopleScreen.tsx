// src/screens/settings/BlockedPeopleScreen.tsx
// Settings → Blocked people: who you've blocked, with Unblock.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ban } from 'lucide-react-native';
import { errorMessage } from '../../api/client';
import { safetyApi } from '../../api/safety';
import type { BlockedPerson } from '../../api/safety';
import Avatar from '../../components/common/Avatar';
import { Banner, Empty } from '../../components/common/ui';
import { showAlert } from '../../components/common/Dialog';
import { useChat } from '../../store/chat';
import { colors, radius, space } from '../../theme';

const BlockedPeopleScreen: React.FC = () => {
  const [people, setPeople] = useState<BlockedPerson[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPeople(await safetyApi.blocked());
      setError('');
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unblock = async (p: BlockedPerson) => {
    setBusy(p.id);
    try {
      await safetyApi.unblock(p.id);
      useChat.getState().setBlocked(p.id, false);
      setPeople((list) => list?.filter((x) => x.id !== p.id) ?? null);
    } catch (e) {
      showAlert("Couldn't unblock", errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  if (!people && !error) return <View style={styles.center}><ActivityIndicator color={colors.primary700} /></View>;

  return (
    <ScrollView contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <Text style={styles.lead}>
        People you've blocked can't message you directly, start a chat with you or add you to groups. They aren't told.
      </Text>
      {!!error && <Banner text={error} />}
      {people?.length === 0 && <Empty icon={Ban} title="Nobody blocked" text="You can block someone from their chat info." />}
      {people?.map((p) => (
        <View key={p.id} style={styles.card}>
          <Avatar uri={p.avatar} name={p.name || p.username} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{p.name || p.username}</Text>
            <Text style={styles.sub} numberOfLines={1}>@{p.username}</Text>
          </View>
          <Pressable onPress={() => unblock(p)} disabled={busy !== null} style={[styles.unblock, busy !== null && { opacity: 0.5 }]}
            accessibilityLabel={`Unblock ${p.name || p.username}`}>
            {busy === p.id ? <ActivityIndicator size="small" color={colors.primary700} /> : <Text style={styles.unblockText}>Unblock</Text>}
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: space(4), paddingBottom: space(10), gap: space(3), backgroundColor: colors.background, flexGrow: 1 },
  lead: { fontSize: 13, color: colors.muted500 },
  card: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3), borderRadius: radius.lg,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.muted200 },
  name: { fontSize: 15, fontWeight: '600', color: colors.muted900 },
  sub: { fontSize: 13, color: colors.muted500 },
  unblock: { paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: radius.md, borderWidth: 1, borderColor: colors.muted200 },
  unblockText: { fontSize: 13, fontWeight: '600', color: colors.primary700 },
});

export default BlockedPeopleScreen;
