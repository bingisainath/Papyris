// src/screens/auth/SignUpScreen.tsx
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../store/auth';
import { Banner, Button, TextField } from '../../components/ui';
import { colors, space } from '../../theme';
import AuthLayout from './AuthLayout';
import { passwordProblem } from '../../utils/password';
import type { AuthStackParams } from '../../navigation/types';

const USERNAME = /^[a-z0-9._]{3,30}$/;

const SignUpScreen: React.FC<NativeStackScreenProps<AuthStackParams, 'SignUp'>> = ({ navigation }) => {
  const register = useAuth((s) => s.register);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ username?: string; email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const name = username.trim().toLowerCase();
    const mail = email.trim().toLowerCase();
    const next = {
      username: USERNAME.test(name) ? undefined : '3-30 lowercase letters, numbers, dots or underscores',
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) ? undefined : 'Enter a valid email address',
      password: passwordProblem(password) || undefined,
    };
    setErrors(next);
    if (next.username || next.email || next.password) return;
    setBusy(true);
    setError(null);
    try {
      await register(name, mail, password);
      navigation.replace('VerifyEmail', { email: mail, justSent: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="We'll email you a code to confirm it's you">
      {error && <Banner text={error} />}
      <TextField label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false}
        error={errors.username} hint="People can find you by it" />
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
        textContentType="emailAddress" autoComplete="email" error={errors.email} />
      <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword"
        autoComplete="new-password" error={errors.password} hint="8+ characters: upper and lower case, a number and a symbol" />
      <Button title="Create account" onPress={submit} loading={busy} />
      <View style={styles.footer}>
        <Text style={styles.muted}>Already have an account? </Text>
        <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}><Text style={styles.link}>Sign in</Text></Pressable>
      </View>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  link: { color: colors.primary700, fontWeight: '600', fontSize: 14 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: space(5) },
  muted: { color: colors.muted600, fontSize: 14 },
});

export default SignUpScreen;
