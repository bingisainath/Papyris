// src/screens/settings/SettingsScreen.tsx
import React, { useCallback, useState } from 'react';
import { Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, ChevronRight, LogOut, ScanLine, ShieldCheck, Store } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar from '../../components/Avatar';
import { Divider } from '../../components/ui';
import { enablePush, pushStatus } from '../../notifications/push';
import { logoutRisk } from '../../crypto/backupRuntime';
import { useAuth } from '../../store/auth';
import { useChat } from '../../store/chat';
import { colors, space } from '../../theme';
import type { AppStackParams } from '../../navigation/types';

type PushState = Awaited<ReturnType<typeof pushStatus>>;

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParams>>();
  const { user, logout } = useAuth();
  const [push, setPush] = useState<PushState | null>(null);

  // Re-check when the screen is shown and when coming back from the phone's settings
  useFocusEffect(useCallback(() => {
    const check = () => pushStatus().then(setPush);
    check();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => sub.remove();
  }, []));

  if (!user) return null;

  const notifications = async () => {
    if (push === 'unavailable') {
      Alert.alert('Notifications', 'Notifications aren\'t set up in this build of the app yet.');
      return;
    }
    if (push === 'off') {
      // Asks again if Android still allows it; once refused for good, only the phone's settings can turn it on
      await enablePush();
      const now = await pushStatus();
      setPush(now);
      if (now === 'on') return;
    }
    Linking.openSettings();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: space(8) }}>
        <Text style={styles.title}>Settings</Text>
        <Pressable onPress={() => navigation.navigate('Profile')} style={({ pressed }) => [styles.profile, pressed && { backgroundColor: colors.muted50 }]}>
          <Avatar uri={user.avatar} name={user.name || user.username} size={60} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user.name || user.username}</Text>
            <Text style={styles.sub} numberOfLines={1}>{user.bio || `@${user.username}`}</Text>
          </View>
          <ChevronRight size={18} color={colors.muted400} />
        </Pressable>

        <View style={styles.section}>
          <Row icon={ShieldCheck} label="End-to-end encryption" hint="On · link a new device" onPress={() => navigation.navigate('Encryption')} />
          <Divider />
          <Row icon={Bell} label="Notifications" onPress={notifications}
            value={push === null ? '' : push === 'on' ? 'On' : push === 'off' ? 'Off' : 'Not set up'} />
        </View>

        <Text style={styles.sectionTitle}>Expenses</Text>
        <View style={styles.section}>
          <Row icon={ScanLine} label="Receipt scanning" hint="AI model and your own keys" onPress={() => navigation.navigate('ReceiptScanning')} />
          <Divider />
          <Row icon={Store} label="Store discounts" hint="Staff or member discounts" onPress={() => navigation.navigate('StoreDiscounts')} />
        </View>

        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{user.email}</Text>
            </View>
          </View>
          <Divider />
          <Pressable
            onPress={async () => {
              // Logging out of the last signed-in device makes encrypted chats unreadable: warn first
              const risk = await logoutRisk().catch(() => ({ lastDevice: true, hasBackup: false }));
              const doLogout = async () => { useChat.getState().reset(); await logout(); };
              if (!risk.lastDevice) {
                Alert.alert('Log out?', 'You can sign back in any time.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Log out', style: 'destructive', onPress: doLogout },
                ]);
              } else if (risk.hasBackup) {
                Alert.alert('Log out of your only device?', "No other phone or browser is signed in. To read your encrypted chats again after logging out, you'll need your 64-digit backup recovery key. Make sure you have it.", [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Log out anyway', style: 'destructive', onPress: doLogout },
                ]);
              } else {
                Alert.alert('Log out of your only device?', "No other phone or browser is signed in, and you have no backup. If you log out, your end-to-end encrypted chats can't be read again, on any device.", [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Turn on backup', onPress: () => navigation.navigate('Encryption') },
                  { text: 'Log out anyway', style: 'destructive', onPress: doLogout },
                ]);
              }
            }}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.muted50 }]}
          >
            <LogOut size={20} color={colors.danger600} />
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const Row: React.FC<{ icon: LucideIcon; label: string; hint?: string; value?: string; onPress: () => void }> = ({ icon: Icon, label, hint, value, onPress }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.muted50 }]}>
    <Icon size={20} color={colors.primary700} />
    <View style={{ flex: 1 }}>
      <Text style={styles.rowText}>{label}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
    {!!value && <Text style={styles.rowValue}>{value}</Text>}
    <ChevronRight size={18} color={colors.muted400} />
  </Pressable>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  title: { paddingHorizontal: space(4), paddingTop: space(2), paddingBottom: space(3), fontSize: 26, fontWeight: '700', color: colors.muted900 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space(4), padding: space(4), backgroundColor: colors.white },
  name: { fontSize: 18, fontWeight: '600', color: colors.muted900 },
  sub: { fontSize: 14, color: colors.muted500, marginTop: 2 },
  section: { marginTop: space(3), backgroundColor: colors.white },
  sectionTitle: { paddingHorizontal: space(4), paddingTop: space(5), fontSize: 12, fontWeight: '700', color: colors.muted500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: -space(1) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(4), paddingHorizontal: space(4), paddingVertical: space(3.5) },
  rowText: { fontSize: 16, color: colors.muted900 },
  rowValue: { fontSize: 14, color: colors.muted500 },
  hint: { fontSize: 12, color: colors.muted500, marginTop: 1 },
  label: { fontSize: 12, color: colors.muted500 },
  value: { fontSize: 15, color: colors.muted900, marginTop: 2 },
  logoutText: { fontSize: 16, color: colors.danger600, fontWeight: '500' },
});

export default SettingsScreen;
