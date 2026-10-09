// src/screens/settings/SessionsScreen.tsx
// Settings → Sessions: the phones and browsers signed in to this account right now, with when each
// signed in and was last active, and whether it's linked for end-to-end encryption.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Globe, QrCode, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParams } from '../../navigation/types';
import { api, errorMessage } from '../../api/client';
import { Banner, Button } from '../../components/ui';
import { v2Runtime } from '../../crypto/v2-platform/runtime';
import { colors, radius, space } from '../../theme';

export interface Session {
  device_id: number;
  name: string;
  created_at: string | null;
  last_seen_at: string | null;
  linked: boolean;
}

const BROWSERS = /^(Chrome|Firefox|Safari|Edge|Browser)\b/;

/** "Active now", "5 min ago", "Yesterday, 14:05", "3 Oct 2026" */
export function activeLabel(iso: string | null): string {
  if (!iso) return 'Unknown';
  const t = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - t) / 60000);
  if (minutes < 2) return 'Active now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} h ago`;
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

const dateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown');

const SessionsScreen: React.FC<NativeStackScreenProps<AppStackParams, 'Sessions'>> = ({ navigation }) => {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [mine, setMine] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [data, me] = await Promise.all([
        api.get('/e2e/v2/devices/me').then((r) => r.data.data.devices as Session[]),
        v2Runtime()?.then((r) => r.state.deviceId).catch(() => null) ?? Promise.resolve(null),
      ]);
      // This device first, then the most recently active
      setSessions([...data].sort((a, b) => Number(b.device_id === me) - Number(a.device_id === me)
        || new Date(b.last_seen_at || 0).getTime() - new Date(a.last_seen_at || 0).getTime()));
      setMine(me);
      setError('');
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!sessions && !error) return <View style={styles.center}><ActivityIndicator color={colors.primary700} /></View>;

  return (
    <ScrollView contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <Text style={styles.lead}>Phones and browsers signed in to your account. Logging out on a device ends its session.</Text>
      <Button title="Link a device" icon={QrCode} onPress={() => navigation.navigate('Encryption', { scan: true })} />
      {!!error && <Banner text={error} />}
      {sessions?.map((s) => {
        const Icon = BROWSERS.test(s.name) ? Globe : Smartphone;
        const current = s.device_id === mine;
        return (
          <View key={s.device_id} style={[styles.card, current && styles.cardCurrent]}>
            <View style={[styles.icon, current && { backgroundColor: colors.primary700 }]}>
              <Icon size={20} color={current ? colors.white : colors.primary700} />
            </View>
            <View style={styles.flex}>
              <View style={styles.titleRow}>
                <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                {current && <Text style={styles.badge}>This device</Text>}
              </View>
              <Text style={styles.active}>{current ? 'Active now' : activeLabel(s.last_seen_at)}</Text>
              <Text style={styles.detail}>Signed in {dateTime(s.created_at)}</Text>
              <View style={styles.encRow}>
                {s.linked ? <ShieldCheck size={13} color={colors.success700} /> : <ShieldOff size={13} color={colors.warning700} />}
                <Text style={[styles.detail, { color: s.linked ? colors.success700 : colors.warning700 }]}>
                  {s.linked ? 'Linked: can read your encrypted chats' : 'Not linked yet: waiting to be approved'}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: space(4), paddingBottom: space(10), gap: space(3), backgroundColor: colors.background, flexGrow: 1 },
  lead: { fontSize: 13, color: colors.muted500 },
  flex: { flex: 1 },
  card: { flexDirection: 'row', gap: space(3), padding: space(4), borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.muted200 },
  cardCurrent: { borderColor: colors.primary300 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary50 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  name: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: colors.muted900 },
  badge: { fontSize: 11, fontWeight: '700', color: colors.primary800, backgroundColor: colors.primary50, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, overflow: 'hidden' },
  active: { marginTop: 2, fontSize: 13, color: colors.muted700 },
  detail: { fontSize: 12, color: colors.muted500, marginTop: 2 },
  encRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: space(1) },
});

export default SessionsScreen;
