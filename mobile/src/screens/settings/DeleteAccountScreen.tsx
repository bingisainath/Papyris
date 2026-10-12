// src/screens/settings/DeleteAccountScreen.tsx
// Settings → Delete account: what happens, then the password and the word DELETE.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, KeyRound, Trash2 } from 'lucide-react-native';
import { authApi } from '../../api/auth';
import { errorMessage } from '../../api/client';
import { Banner, Button, TextField } from '../../components/common/ui';
import { useAuth } from '../../store/auth';
import { useChat } from '../../store/chat';
import { colors, space } from '../../theme';

const WHAT_HAPPENS = [
  'Every phone and browser is signed out and wiped; your encrypted chats can\'t be read again.',
  'Your profile, photo, devices, backup, settings and what your messages said are removed.',
  'You leave your groups. Shared expenses and payments stay, shown as "Deleted user", so other people\'s balances don\'t change.',
  'You can sign up again later with the same email, as a new account.',
];

const DeleteAccountScreen: React.FC = () => {
  const accountDeleted = useAuth((s) => s.accountDeleted);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = !!password && confirm.trim().toUpperCase() === 'DELETE';

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await authApi.deleteAccount(password, confirm);
      useChat.getState().reset();
      await accountDeleted(); // signs out and wipes this phone
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.warning}>
        <AlertTriangle size={22} color={colors.danger600} />
        <Text style={styles.title}>Delete your account?</Text>
      </View>
      {WHAT_HAPPENS.map((line) => (
        <View key={line} style={styles.point}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.pointText}>{line}</Text>
        </View>
      ))}
      <View style={{ height: space(4) }} />
      {error && <Banner text={error} />}
      <TextField label="Your password" icon={KeyRound} value={password} onChangeText={setPassword} secureTextEntry
        autoComplete="password" textContentType="password" />
      <TextField label="Type DELETE to confirm" value={confirm} onChangeText={setConfirm} autoCapitalize="characters"
        autoCorrect={false} />
      <Button title="Delete my account" icon={Trash2} variant="danger" onPress={submit} loading={busy} disabled={!ready} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: space(5), paddingBottom: space(10) },
  warning: { flexDirection: 'row', alignItems: 'center', gap: space(2.5), marginBottom: space(3) },
  title: { fontSize: 20, fontWeight: '700', color: colors.muted900 },
  point: { flexDirection: 'row', gap: space(2), marginTop: space(2) },
  bullet: { fontSize: 15, color: colors.muted500 },
  pointText: { flex: 1, fontSize: 15, lineHeight: 21, color: colors.muted700 },
});

export default DeleteAccountScreen;
