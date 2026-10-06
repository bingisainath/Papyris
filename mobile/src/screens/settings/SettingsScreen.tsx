// src/screens/settings/SettingsScreen.tsx
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight, LogOut } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar from '../../components/Avatar';
import { useAuth } from '../../store/auth';
import { useChat } from '../../store/chat';
import { colors, radius, space } from '../../theme';
import type { AppStackParams } from '../../navigation/types';

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParams>>();
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView>
        <Text style={styles.title}>Settings</Text>
        <Pressable onPress={() => navigation.navigate('Profile')} style={({ pressed }) => [styles.profile, pressed && { backgroundColor: colors.muted50 }]}>
          <Avatar uri={user.avatar} name={user.name || user.username} size={60} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user.name || user.username}</Text>
            <Text style={styles.sub}>{user.bio || `@${user.username}`}</Text>
          </View>
          <ChevronRight size={18} color={colors.muted400} />
        </Pressable>
        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user.email}</Text>
        </View>
        <Pressable
          onPress={() => Alert.alert('Log out?', 'You can sign back in any time.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log out', style: 'destructive', onPress: async () => { useChat.getState().reset(); await logout(); } },
          ])}
          style={styles.logout}
        >
          <LogOut size={20} color={colors.danger600} />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
        <Text style={styles.footer}>Receipt-scanning model, your own AI keys and store discounts are in the web app's Settings.</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  title: { paddingHorizontal: space(4), paddingTop: space(2), paddingBottom: space(3), fontSize: 26, fontWeight: '700', color: colors.muted900 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space(4), padding: space(4), backgroundColor: colors.white },
  name: { fontSize: 18, fontWeight: '600', color: colors.muted900 },
  sub: { fontSize: 14, color: colors.muted500, marginTop: 2 },
  card: { marginTop: space(3), padding: space(4), backgroundColor: colors.white },
  label: { fontSize: 12, color: colors.muted500 },
  value: { fontSize: 15, color: colors.muted900, marginTop: 2 },
  logout: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(3), padding: space(4), backgroundColor: colors.white },
  logoutText: { fontSize: 16, color: colors.danger600, fontWeight: '500' },
  footer: { margin: space(4), fontSize: 12, color: colors.muted500, textAlign: 'center', borderRadius: radius.md },
});

export default SettingsScreen;
