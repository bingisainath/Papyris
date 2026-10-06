// src/screens/chats/ChatInfoScreen.tsx
// Group or contact info: members, admin actions, pin, leave, and the chat's expense settings.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronRight, LogOut, Pin, PinOff, UserPlus, Wallet, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar from '../../components/Avatar';
import UserSearch from '../../components/UserSearch';
import { Divider } from '../../components/ui';
import { chatApi, ConversationDetails, MemberInfo } from '../../api/chat';
import { expenseService, ExpenseSettings } from '../../api/expenses';
import { api, errorMessage } from '../../api/client';
import { useAuth } from '../../store/auth';
import { useChat } from '../../store/chat';
import { colors, radius, space } from '../../theme';
import type { AppStackParams } from '../../navigation/types';
import CurrencyPicker from '../expenses/CurrencyPicker';

const ChatInfoScreen: React.FC<NativeStackScreenProps<AppStackParams, 'ChatInfo'>> = ({ route, navigation }) => {
  const { conversationId, addMembers } = route.params;
  const me = useAuth((s) => s.user)!;
  const pinned = useChat((s) => !!s.conversations.find((c) => c.id === conversationId)?.isPinned);
  const [details, setDetails] = useState<ConversationDetails | null>(null);
  const [settings, setSettings] = useState<ExpenseSettings | null>(null);
  const [adding, setAdding] = useState(false);
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([chatApi.details(conversationId), expenseService.settings(conversationId)]);
      setDetails(d);
      setSettings(s);
    } catch (e) {
      Alert.alert("Couldn't load info", errorMessage(e));
      navigation.goBack();
    }
  }, [conversationId, navigation]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (addMembers && details?.my_role === 'admin') setAdding(true); }, [addMembers, details]);

  if (!details) return <View style={styles.center}><ActivityIndicator color={colors.primary700} /></View>;

  const isGroup = details.kind === 'group';
  const isAdmin = details.my_role === 'admin';
  const other = details.members.find((m) => !m.is_me);
  const title = isGroup ? details.title : other?.name || other?.username;

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await load();
      useChat.getState().loadConversations().catch(() => undefined);
    } catch (e) {
      Alert.alert('Something went wrong', errorMessage(e));
    }
  };

  const memberActions = (member: MemberInfo) => {
    if (!isAdmin || member.is_me) return;
    Alert.alert(member.name || member.username, undefined, [
      member.role === 'admin'
        ? { text: 'Remove as admin', onPress: () => run(() => api.patch(`/conversations/${conversationId}/members/${member.id}`, { role: 'member' })) }
        : { text: 'Make group admin', onPress: () => run(() => api.patch(`/conversations/${conversationId}/members/${member.id}`, { role: 'admin' })) },
      { text: 'Remove from group', style: 'destructive', onPress: () => run(() => chatApi.removeMember(conversationId, member.id)) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const leave = () => Alert.alert('Leave this group?', 'You will stop receiving its messages.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Leave', style: 'destructive',
      onPress: async () => {
        try {
          await chatApi.leave(conversationId, me.id);
          await useChat.getState().loadConversations();
          navigation.popToTop();
        } catch (e) {
          Alert.alert("Couldn't leave", errorMessage(e));
        }
      },
    },
  ]);

  const updateSettings = async (patch: Partial<Omit<ExpenseSettings, 'can_edit'>>) => {
    try {
      setSettings(await expenseService.updateSettings(conversationId, patch));
    } catch (e) {
      Alert.alert("Couldn't save", errorMessage(e));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView>
        <View style={styles.hero}>
          <Avatar uri={isGroup ? details.avatar_url : other?.avatar} name={title} size={88} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{isGroup ? `Group · ${details.members.length} members` : `@${other?.username}`}</Text>
          {(isGroup ? details.description : other?.bio) ? <Text style={styles.about}>{isGroup ? details.description : other?.bio}</Text> : null}
        </View>

        <View style={styles.section}>
          <Row icon={Wallet} label="Balances & expenses" onPress={() => navigation.navigate('ChatExpenses', { conversationId })} />
          <Divider />
          <Row icon={pinned ? PinOff : Pin} label={pinned ? 'Unpin chat' : 'Pin chat'} onPress={() => run(async () => {
            await chatApi.pin(conversationId, !pinned);
            useChat.getState().setPinned(conversationId, !pinned);
          })} />
        </View>

        {settings && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Expenses</Text>
            <Pressable style={styles.settingRow} disabled={!settings.can_edit} onPress={() => setPicking(true)}>
              <Text style={styles.settingLabel}>Default currency</Text>
              <Text style={styles.settingValue}>{settings.default_currency}</Text>
            </Pressable>
            <Divider />
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Simplify debts</Text>
                <Text style={styles.settingHint}>Fewest payments to settle up</Text>
              </View>
              <Switch value={settings.simplify_debts} disabled={!settings.can_edit} onValueChange={(v) => updateSettings({ simplify_debts: v })}
                trackColor={{ true: colors.primary600, false: colors.muted300 }} thumbColor={colors.white} />
            </View>
            {!settings.can_edit && <Text style={[styles.settingHint, { paddingHorizontal: space(4), paddingBottom: space(3) }]}>Only group admins can change these.</Text>}
          </View>
        )}

        {isGroup && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{details.members.length} members</Text>
              {isAdmin && (
                <Pressable onPress={() => setAdding(true)} style={styles.addButton} hitSlop={8}>
                  <UserPlus size={16} color={colors.primary700} />
                  <Text style={styles.addText}>Add</Text>
                </Pressable>
              )}
            </View>
            {details.members.map((member, i) => (
              <View key={member.id}>
                {i > 0 && <Divider />}
                <Pressable onPress={() => memberActions(member)} style={styles.member}>
                  <Avatar uri={member.avatar} name={member.name || member.username} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{member.is_me ? 'You' : member.name || member.username}</Text>
                    <Text style={styles.settingHint}>@{member.username}</Text>
                  </View>
                  {member.role === 'admin' && <Text style={styles.adminBadge}>Admin</Text>}
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {isGroup && (
          <View style={styles.section}>
            <Row icon={LogOut} label="Leave group" danger onPress={leave} />
          </View>
        )}
      </ScrollView>

      <Modal visible={adding} animationType="slide" onRequestClose={() => setAdding(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add members</Text>
            <Pressable onPress={() => setAdding(false)} hitSlop={10} accessibilityLabel="Close"><X size={22} color={colors.muted600} /></Pressable>
          </View>
          <UserSearch
            exclude={details.members.map((m) => m.id)}
            onPick={(user) => {
              setAdding(false);
              run(() => chatApi.addMembers(conversationId, [user.id]));
            }}
          />
        </SafeAreaView>
      </Modal>

      <CurrencyPicker visible={picking} value={settings?.default_currency || 'EUR'} onClose={() => setPicking(false)}
        onPick={(code) => { setPicking(false); updateSettings({ default_currency: code }); }} />
    </SafeAreaView>
  );
};

const Row: React.FC<{ icon: React.ComponentType<{ size?: number; color?: string }>; label: string; onPress: () => void; danger?: boolean }> = ({ icon: Icon, label, onPress, danger }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.muted50 }]}>
    <Icon size={20} color={danger ? colors.danger600 : colors.primary700} />
    <Text style={[styles.rowText, danger && { color: colors.danger600 }]}>{label}</Text>
    {!danger && <ChevronRight size={18} color={colors.muted400} />}
  </Pressable>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', paddingVertical: space(6), backgroundColor: colors.white },
  title: { marginTop: space(3), fontSize: 22, fontWeight: '700', color: colors.muted900 },
  subtitle: { marginTop: space(1), fontSize: 14, color: colors.muted500 },
  about: { marginTop: space(3), paddingHorizontal: space(8), fontSize: 14, color: colors.muted700, textAlign: 'center' },
  section: { marginTop: space(3), backgroundColor: colors.white },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: space(4) },
  sectionTitle: { paddingHorizontal: space(4), paddingTop: space(3), paddingBottom: space(2), fontSize: 12, fontWeight: '700', color: colors.muted500, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(4), paddingHorizontal: space(4), paddingVertical: space(3.5) },
  rowText: { flex: 1, fontSize: 16, color: colors.muted900 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(4), paddingVertical: space(3) },
  settingLabel: { fontSize: 15, color: colors.muted900 },
  settingValue: { fontSize: 15, color: colors.primary700, fontWeight: '600' },
  settingHint: { fontSize: 12, color: colors.muted500 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: space(2) },
  addText: { color: colors.primary700, fontWeight: '600' },
  member: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(2.5) },
  memberName: { fontSize: 15, color: colors.muted900, fontWeight: '500' },
  adminBadge: { fontSize: 11, color: colors.primary800, backgroundColor: colors.primary100, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, overflow: 'hidden' },
  modal: { flex: 1, backgroundColor: colors.white },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space(4) },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.muted900 },
});

export default ChatInfoScreen;
