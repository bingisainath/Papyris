// src/screens/chats/NewGroupScreen.tsx
import React, { useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { X } from 'lucide-react-native';
import UserSearch from '../../components/UserSearch';
import { TextField } from '../../components/ui';
import { chatApi, UserSummary } from '../../api/chat';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../store/auth';
import { useChat } from '../../store/chat';
import { colors, radius, space } from '../../theme';
import type { AppStackParams } from '../../navigation/types';
import { showAlert } from '../../components/Dialog';

const NewGroupScreen: React.FC<NativeStackScreenProps<AppStackParams, 'NewGroup'>> = ({ navigation }) => {
  const me = useAuth((s) => s.user)!;
  const [title, setTitle] = useState('');
  const [members, setMembers] = useState<UserSummary[]>([]);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!title.trim()) { showAlert('Name the group'); return; }
    if (!members.length) { showAlert('Add at least one person'); return; }
    setBusy(true);
    try {
      const created = await chatApi.createGroup(title.trim(), members.map((m) => m.id));
      await useChat.getState().loadConversations();
      navigation.replace('Chat', { conversationId: created.id });
    } catch (e) {
      showAlert("Couldn't create the group", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={create} disabled={busy} hitSlop={8} accessibilityLabel="Create group">
          <Text style={[styles.create, busy && { opacity: 0.5 }]}>Create</Text>
        </Pressable>
      ),
    });
  });

  const toggle = (user: UserSummary) =>
    setMembers((list) => (list.some((m) => m.id === user.id) ? list.filter((m) => m.id !== user.id) : [...list, user]));

  return (
    <View style={styles.container}>
      <UserSearch
        exclude={[me.id]}
        selected={members.map((m) => m.id)}
        onPick={toggle}
        header={
          <View style={styles.top}>
            <TextField label="Group name" value={title} onChangeText={setTitle} maxLength={100} placeholder="e.g. Flat 4B" />
            {members.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {members.map((m) => (
                  <Pressable key={m.id} onPress={() => toggle(m)} style={styles.chip} accessibilityLabel={`Remove ${m.name || m.username}`}>
                    <Text style={styles.chipText}>{m.name || m.username}</Text>
                    <X size={14} color={colors.primary800} />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  top: { paddingHorizontal: space(4), paddingTop: space(4) },
  create: { color: colors.primary700, fontSize: 16, fontWeight: '700' },
  chips: { gap: space(2), paddingBottom: space(1) },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: radius.full, backgroundColor: colors.primary100 },
  chipText: { color: colors.primary800, fontSize: 13, fontWeight: '500' },
});

export default NewGroupScreen;
