// src/screens/auth/VerifyEmailScreen.tsx
// Enter the 6-digit code emailed after sign-up. The phone can fill it in from the email (one-time-code).
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../store/auth';
import { Banner, Button } from '../../components/ui';
import { colors, radius, space } from '../../theme';
import AuthLayout from './AuthLayout';
import type { AuthStackParams } from '../../navigation/types';

const LENGTH = 6;

const VerifyEmailScreen: React.FC<NativeStackScreenProps<AuthStackParams, 'VerifyEmail'>> = ({ route, navigation }) => {
  const { email, justSent } = route.params;
  const { verifyEmail, resendCode } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(justSent ? 60 : 0);
  const input = useRef<TextInput>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const submit = async (value = code) => {
    if (value.length !== LENGTH) return;
    setBusy(true);
    setError(null);
    try {
      await verifyEmail(email, value);
    } catch (err) {
      setError((err as Error).message);
      setCode('');
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      await resendCode(email);
      setWait(60);
      setInfo('We sent a new code');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <AuthLayout title="Check your email" subtitle={`We sent a 6-digit code to ${email}. It expires in 10 minutes.`}>
      {error && <Banner text={error} />}
      {info && !error && <Banner tone="info" text={info} />}
      <Pressable onPress={() => input.current?.focus()} style={styles.boxes} accessibilityLabel="Verification code">
        {Array.from({ length: LENGTH }).map((_, i) => (
          <View key={i} style={[styles.box, i === code.length && styles.boxActive]}>
            <Text style={styles.digit}>{code[i] || ''}</Text>
          </View>
        ))}
      </Pressable>
      {/* One hidden field holds the code so paste and SMS/email autofill work */}
      <TextInput
        ref={input}
        value={code}
        onChangeText={(t) => {
          const digits = t.replace(/\D/g, '').slice(0, LENGTH);
          setCode(digits);
          if (digits.length === LENGTH) submit(digits);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus
        maxLength={LENGTH}
        style={styles.hidden}
        accessibilityLabel="Verification code"
      />
      <Button title="Verify" onPress={() => submit()} loading={busy} disabled={code.length !== LENGTH} />
      <View style={styles.footer}>
        <Text style={styles.muted}>Didn't get it? Check spam, or </Text>
        {wait > 0 ? (
          <Text style={styles.muted}>send a new code in {wait}s</Text>
        ) : (
          <Pressable onPress={resend} hitSlop={8}><Text style={styles.link}>send a new code</Text></Pressable>
        )}
      </View>
      <Pressable onPress={() => navigation.navigate('Login')} style={styles.back} hitSlop={8}>
        <Text style={styles.link}>Back to sign in</Text>
      </Pressable>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space(5) },
  box: { width: 44, height: 54, borderRadius: radius.md, borderWidth: 1, borderColor: colors.muted300, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  boxActive: { borderColor: colors.primary600, borderWidth: 2 },
  digit: { fontSize: 22, fontWeight: '600', color: colors.muted900 },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: space(5) },
  muted: { color: colors.muted600, fontSize: 14 },
  link: { color: colors.primary700, fontWeight: '600', fontSize: 14 },
  back: { alignSelf: 'center', marginTop: space(4) },
});

export default VerifyEmailScreen;
