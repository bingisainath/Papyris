// src/screens/auth/AuthLayout.tsx
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space } from '../../theme';
import { useKeyboardOffset } from '../../hooks/useKeyboardOffset';

const AuthLayout: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => {
  const keyboard = useKeyboardOffset();
  return (
    <SafeAreaView style={styles.safe}>
      <View ref={keyboard.ref} style={[styles.flex, { paddingBottom: keyboard.offset }]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logo}>
            <Text style={styles.logoText}>P</Text>
          </View>
          <Text style={styles.brand}>Papyris</Text>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          <View style={styles.card}>{children}</View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space(6) },
  logo: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: colors.white, fontSize: 26, fontWeight: '700' },
  brand: {
    alignSelf: 'center',
    marginTop: space(2),
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary700,
  },
  title: {
    marginTop: space(6),
    fontSize: 24,
    fontWeight: '700',
    color: colors.muted900,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: space(2),
    fontSize: 15,
    color: colors.muted600,
    textAlign: 'center',
  },
  card: {
    marginTop: space(6),
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.muted200,
    padding: space(5),
  },
});

export default AuthLayout;
