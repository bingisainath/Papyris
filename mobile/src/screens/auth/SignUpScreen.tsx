// src/screens/auth/SignUpScreen.tsx
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../store/auth';
import { ArrowRight, AtSign, Check, KeyRound, Mail } from 'lucide-react-native';
import { Banner, Button, TextField } from '../../components/common/ui';
import { colors, space } from '../../theme';
import AuthLayout from './AuthLayout';
import { passwordProblem } from '../../utils/password';
import type { AuthStackParams } from '../../navigation/types';

const USERNAME = /^[a-z0-9._]{3,30}$/;

const PASSWORD_RULES: [string, (p: string) => boolean][] = [
  ['8+ characters', (p) => p.length >= 8],
  ['Upper and lower case', (p) => /[a-z]/.test(p) && /[A-Z]/.test(p)],
  ['A number', (p) => /\d/.test(p)],
  ['A symbol', (p) => /[^A-Za-z0-9]/.test(p)],
];

const PasswordRules: React.FC<{ password: string }> = ({ password }) => (
  <View style={styles.rules}>
    {PASSWORD_RULES.map(([text, ok]) => {
      const met = ok(password);
      return (
        <View key={text} style={styles.rule}>
          <Check size={13} color={met ? colors.success700 : colors.muted300} />
          <Text style={[styles.ruleText, met && { color: colors.success700 }]}>{text}</Text>
        </View>
      );
    })}
  </View>
);

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
    <AuthLayout eyebrow="Your private space" title="Create your account" subtitle="Free and private. We'll email you a code to confirm it's you.">
      {error && <Banner text={error} />}
      <TextField label="Username" icon={AtSign} placeholder="e.g. maya.rao" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false}
        error={errors.username} hint="People can find you by it" />
      <TextField label="Email" icon={Mail} placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
        textContentType="emailAddress" autoComplete="email" error={errors.email} />
      <TextField label="Password" icon={KeyRound} placeholder="Create a password" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword"
        autoComplete="new-password" error={errors.password} hint={<PasswordRules password={password} />} />
      <Button title="Create account" icon={ArrowRight} onPress={submit} loading={busy} />
      <View style={styles.footer}>
        <Text style={styles.muted}>Already have an account? </Text>
        <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}><Text style={styles.link}>Log in</Text></Pressable>
      </View>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  link: { color: colors.primary700, fontWeight: '700', fontSize: 14 },
  rules: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space(2), rowGap: space(1) },
  rule: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  ruleText: { fontSize: 12, color: colors.muted500 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: space(5) },
  muted: { color: colors.muted500, fontSize: 14 },
});

export default SignUpScreen;
