// src/screens/auth/LoginScreen.tsx
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NeedsVerification, useAuth } from '../../store/auth';
import { ArrowRight, KeyRound, UserRound } from 'lucide-react-native';
import { Banner, Button, TextField } from '../../components/common/ui';
import { colors, space } from '../../theme';
import AuthLayout from './AuthLayout';
import type { AuthStackParams } from '../../navigation/types';

const LoginScreen: React.FC<NativeStackScreenProps<AuthStackParams, 'Login'>> = ({ navigation }) => {
  const login = useAuth((s) => s.login);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!identifier.trim() || !password) {
      setError('Enter your username or email and your password');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(identifier, password);
    } catch (err) {
      if (err instanceof NeedsVerification) navigation.navigate('VerifyEmail', { email: err.email, justSent: true });
      else setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout eyebrow="Welcome back" title="Log in to ShareEven" subtitle="Your people and shared moments are waiting.">
      {error && <Banner text={error} />}
      <TextField label="Username or email" icon={UserRound} placeholder="Username or email" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false}
        keyboardType="email-address" textContentType="username" autoComplete="username" returnKeyType="next" />
      <TextField label="Password" icon={KeyRound} placeholder="Your password" value={password} onChangeText={setPassword} secureTextEntry textContentType="password"
        autoComplete="password" returnKeyType="go" onSubmitEditing={submit} />
      <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgot} hitSlop={8}>
        <Text style={styles.link}>Forgot password?</Text>
      </Pressable>
      <Button title="Log in" icon={ArrowRight} onPress={submit} loading={busy} />
      <View style={styles.footer}>
        <Text style={styles.muted}>New to ShareEven? </Text>
        <Pressable onPress={() => navigation.navigate('SignUp')} hitSlop={8}><Text style={styles.link}>Create an account</Text></Pressable>
      </View>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', marginTop: -space(2), marginBottom: space(4) },
  link: { color: colors.primary700, fontWeight: '700', fontSize: 14 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: space(5) },
  muted: { color: colors.muted500, fontSize: 14 },
});

export default LoginScreen;
