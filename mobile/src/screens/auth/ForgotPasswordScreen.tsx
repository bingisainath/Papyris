// src/screens/auth/ForgotPasswordScreen.tsx
// Sends the reset link by email; the link opens the web app to choose a new password.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { authApi } from '../../api/auth';
import { errorMessage } from '../../api/client';
import { UserRound } from 'lucide-react-native';
import { Banner, Button, TextField } from '../../components/common/ui';
import { colors, space } from '../../theme';
import AuthLayout from './AuthLayout';
import type { AuthStackParams } from '../../navigation/types';

const ForgotPasswordScreen: React.FC<NativeStackScreenProps<AuthStackParams, 'ForgotPassword'>> = ({ navigation }) => {
  const [identifier, setIdentifier] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!identifier.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await authApi.forgotPassword(identifier.trim());
      setSentTo(response.data?.data?.email || identifier.trim());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login'))} eyebrow="Account recovery" title="Forgot password?" subtitle="Enter your username or email and we'll send you a reset link.">
      {error && <Banner text={error} />}
      {sentTo ? (
        <Banner tone="success" text={`We sent a reset link to ${sentTo}. It expires in 1 hour. Not there? Check your spam folder.`} />
      ) : (
        <>
          <TextField label="Username or email" icon={UserRound} placeholder="Username or email" value={identifier} onChangeText={setIdentifier} autoCapitalize="none"
            keyboardType="email-address" returnKeyType="send" onSubmitEditing={submit} />
          <Button title="Send reset link" onPress={submit} loading={busy} disabled={!identifier.trim()} />
        </>
      )}
      <Pressable onPress={() => navigation.navigate('Login')} style={styles.back} hitSlop={8}>
        <Text style={styles.link}>Back to sign in</Text>
      </Pressable>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  link: { color: colors.primary700, fontWeight: '600', fontSize: 14 },
  back: { alignSelf: 'center', marginTop: space(5) },
});

export default ForgotPasswordScreen;
