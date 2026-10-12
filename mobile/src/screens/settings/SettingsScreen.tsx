// src/screens/settings/SettingsScreen.tsx
import React, { useCallback, useState } from 'react';
import { AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, ChevronRight, Coins, LogOut, Mail, MonitorSmartphone, ScanLine, ShieldCheck, Store } from 'lucide-react-native';
import CurrencyPicker from '../../components/expenses/CurrencyPicker';
import { authApi } from '../../api/auth';
import { errorMessage } from '../../api/client';
import type { LucideIcon } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar from '../../components/common/Avatar';
import { Divider } from '../../components/common/ui';
import { enablePush, pushStatus } from '../../notifications/push';
import { logoutRisk } from '../../crypto/backupRuntime';
import { useAuth } from '../../store/auth';
import { useChat } from '../../store/chat';
import { colors, space } from '../../theme';
import type { AppStackParams } from '../../navigation/types';
import { showAlert } from '../../components/common/Dialog';

type PushState = Awaited<ReturnType<typeof pushStatus>>;

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParams>>();
  const { user, logout, setUser } = useAuth();
  const [push, setPush] = useState<PushState | null>(null);
  const [pickingCurrency, setPickingCurrency] = useState(false);

  // "Show totals in": expense amounts in other currencies also show converted (≈)
  const setDisplayCurrency = async (code: string) => {
    try {
      setUser(await authApi.updateMe({ display_currency: code }));
    } catch (e) {
      showAlert("Couldn't save that", errorMessage(e));
    }
  };
  const displayCurrency = () => {
    if (!user?.display_currency) { setPickingCurrency(true); return; }
    showAlert('Show totals in', `Amounts in other currencies also show converted to ${user.display_currency}.`, [
      { text: 'Turn off', style: 'destructive', onPress: () => setDisplayCurrency('') },
      { text: 'Change currency', onPress: () => setPickingCurrency(true) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

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
      showAlert('Notifications', 'Notifications aren\'t set up in this build of the app yet.');
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
        <Text style={styles.eyebrow}>YOUR ACCOUNT</Text>
        <Text style={styles.title}>Settings</Text>
        <Pressable onPress={() => navigation.navigate('Profile')} style={({ pressed }) => [styles.profile, pressed && { backgroundColor: colors.muted50 }]}>
          <Avatar uri={user.avatar} name={user.name || user.username} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user.name || user.username}</Text>
            <Text style={styles.sub} numberOfLines={1}>@{user.username}</Text>
            {!!user.bio && <Text style={styles.bio} numberOfLines={2}>{user.bio}</Text>}
          </View>
          <ChevronRight size={18} color={colors.muted400} />
        </Pressable>

        <View style={styles.section}>
          <Row icon={ShieldCheck} label="Linked devices" hint="Link a phone or browser · encryption and backup" onPress={() => navigation.navigate('Encryption')} />
          <Divider />
          <Row icon={MonitorSmartphone} label="Sessions" hint="Devices signed in to your account" onPress={() => navigation.navigate('Sessions')} />
          <Divider />
          <Row icon={Bell} label="Notifications" onPress={notifications}
            value={push === null ? '' : push === 'on' ? 'On' : push === 'off' ? 'Off' : 'Not set up'} />
        </View>

        <Text style={styles.sectionTitle}>Expenses</Text>
        <View style={styles.section}>
          <Row icon={ScanLine} label="Receipt scanning" hint="AI model and your own keys" onPress={() => navigation.navigate('ReceiptScanning')} />
          <Divider />
          <Row icon={Store} label="Store discounts" hint="Staff or member discounts" onPress={() => navigation.navigate('StoreDiscounts')} />
          <Divider />
          <Row icon={Coins} label="Show totals in" hint="Also show amounts converted at today's rate" onPress={displayCurrency}
            value={user.display_currency || 'Off'} />
        </View>
        <CurrencyPicker visible={pickingCurrency} value={user.display_currency || ''} onClose={() => setPickingCurrency(false)}
          onPick={(code) => { setPickingCurrency(false); setDisplayCurrency(code); }} />

        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: colors.muted100 }]}><Mail size={19} color={colors.muted600} /></View>
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
                showAlert('Log out?', 'You can sign back in any time.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Log out', style: 'destructive', onPress: doLogout },
                ]);
              } else if (risk.hasBackup) {
                showAlert('Log out of your only device?', "No other phone or browser is signed in. To read your encrypted chats again after logging out, you'll need your 64-digit backup recovery key. Make sure you have it.", [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Log out anyway', style: 'destructive', onPress: doLogout },
                ]);
              } else {
                showAlert('Log out of your only device?', "No other phone or browser is signed in, and you have no backup. If you log out, your end-to-end encrypted chats can't be read again, on any device.", [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Turn on backup', onPress: () => navigation.navigate('Encryption') },
                  { text: 'Log out anyway', style: 'destructive', onPress: doLogout },
                ]);
              }
            }}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.muted50 }]}
          >
            <View style={[styles.rowIcon, { backgroundColor: colors.danger50 }]}><LogOut size={19} color={colors.danger600} /></View>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const Row: React.FC<{ icon: LucideIcon; label: string; hint?: string; value?: string; onPress: () => void }> = ({ icon: Icon, label, hint, value, onPress }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.muted50 }]}>
    <View style={styles.rowIcon}><Icon size={19} color={colors.primary700} /></View>
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
  eyebrow: { paddingHorizontal: space(4), paddingTop: space(4), fontSize: 11, fontWeight: '700', letterSpacing: 1.3, color: colors.primary500 },
  title: { paddingHorizontal: space(4), marginTop: 2, paddingBottom: space(4), fontSize: 28, fontWeight: '700', letterSpacing: -0.5, color: colors.muted900 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space(4), marginHorizontal: space(4), padding: space(4), borderRadius: 17, borderWidth: 1, borderColor: colors.muted200, backgroundColor: colors.white },
  name: { fontSize: 19, fontWeight: '700', color: colors.muted900 },
  sub: { fontSize: 13, color: colors.muted500, marginTop: 2 },
  bio: { fontSize: 13, color: colors.muted700, marginTop: 4 },
  section: { marginTop: space(3), marginHorizontal: space(4), borderRadius: 17, borderWidth: 1, borderColor: colors.muted200, backgroundColor: colors.white, overflow: 'hidden' },
  sectionTitle: { paddingHorizontal: space(5), paddingTop: space(5), fontSize: 11, fontWeight: '700', color: colors.muted500, textTransform: 'uppercase', letterSpacing: 1, marginBottom: -space(1) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(3) },
  rowIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary50, alignItems: 'center', justifyContent: 'center' },
  rowText: { fontSize: 16, fontWeight: '600', color: colors.muted900 },
  rowValue: { fontSize: 14, color: colors.muted500 },
  hint: { fontSize: 12, color: colors.muted500, marginTop: 1 },
  label: { fontSize: 12, color: colors.muted500 },
  value: { fontSize: 15, color: colors.muted900, marginTop: 2 },
  logoutText: { fontSize: 16, color: colors.danger600, fontWeight: '500' },
});

export default SettingsScreen;
