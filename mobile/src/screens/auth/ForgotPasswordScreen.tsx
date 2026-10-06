// src/screens/auth/ForgotPasswordScreen.tsx
// Sends the reset link by email; the link opens the web app to choose a new password.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { authApi } from '../../api/auth';
import { errorMessage } from '../../api/client';
import { Banner, Button, TextField } from '../../components/ui';
import { colors, space } from '../../theme';
import AuthLayout from './AuthLayout';
import type { AuthStackParams } from '../../navigation/types';

const ForgotPasswordScreen: React.FC<NativeStackScreenProps<AuthStackParams, 'ForgotPassword'>> = ({ navigation }) => {
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!identifier.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await authApi.forgotPassword(identifier.trim());
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Forgot password?" subtitle="Enter your username or email and we'll send you a reset link.">
      {error && <Banner text={error} />}
      {sent ? (
        <Banner tone="success" text={`If an account exists for ${identifier.trim()}, a reset link is on its way. It expires in 1 hour.`} />
      ) : (
        <>
          <TextField label="Username or email" value={identifier} onChangeText={setIdentifier} autoCapitalize="none"
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
