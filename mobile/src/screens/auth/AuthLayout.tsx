// src/screens/auth/AuthLayout.tsx
// The frame for the signed-out screens: brand on top, a small eyebrow, the title, then the form.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock } from 'lucide-react-native';
import { colors, space } from '../../theme';
import { useKeyboardOffset } from '../../hooks/useKeyboardOffset';
import InfoLinks from '../../components/common/InfoLinks';

const AuthLayout: React.FC<{
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ eyebrow, title, subtitle, children }) => {
  const keyboard = useKeyboardOffset();
  return (
    <SafeAreaView style={styles.safe}>
      <View ref={keyboard.ref} style={[styles.flex, { paddingBottom: keyboard.offset }]}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>S</Text>
            </View>
            <Text style={styles.brand}>ShareEven</Text>
          </View>
          <View style={styles.body}>
            {eyebrow && <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>}
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            <View style={styles.form}>{children}</View>
          </View>
          <View style={styles.footer}>
            <Lock size={13} color={colors.muted400} />
            <Text style={styles.footerText}>Messages and media are end-to-end encrypted</Text>
          </View>
          <InfoLinks />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: space(5), paddingTop: space(7), paddingBottom: space(5) },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space(2.5) },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.primary700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: colors.white, fontSize: 20, fontWeight: '700' },
  brand: { fontSize: 20, fontWeight: '700', color: colors.muted900 },
  body: { flex: 1, justifyContent: 'center', paddingVertical: space(8) },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.3, color: colors.primary500 },
  title: { marginTop: space(1.5), fontSize: 28, fontWeight: '700', letterSpacing: -0.6, color: colors.muted900 },
  subtitle: { marginTop: space(2), fontSize: 15, lineHeight: 21, color: colors.muted500 },
  form: { marginTop: space(7) },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(1.5) },
  footerText: { fontSize: 12, color: colors.muted400 },
});

export default AuthLayout;
