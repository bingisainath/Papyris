// src/components/ui.tsx
// Small building blocks shared by the screens.

import React, { useState } from 'react';
import {
  ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import { Eye, EyeOff, LucideIcon } from 'lucide-react-native';
import { colors, radius, space } from '../../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export const Button: React.FC<{
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}> = ({ title, onPress, variant = 'primary', loading, disabled, icon: Icon, style, compact }) => {
  const palette = {
    primary: { bg: colors.primary700, fg: colors.white, border: colors.primary700 },
    secondary: { bg: colors.primary50, fg: colors.primary700, border: colors.primary100 },
    ghost: { bg: 'transparent', fg: colors.primary700, border: 'transparent' },
    danger: { bg: colors.white, fg: colors.danger600, border: colors.muted300 },
  }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        variant === 'primary' && !off && styles.raised,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: off ? 0.55 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {Icon && <Icon size={18} color={palette.fg} />}
          <Text style={[styles.buttonText, { color: palette.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
};

export const TextField: React.FC<TextInputProps & { label?: string; error?: string | null; hint?: React.ReactNode; icon?: LucideIcon }> = ({
  label, error, hint, icon: Icon, secureTextEntry, style, ...props
}) => {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);
  return (
    <View style={styles.field}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputBox, focused && styles.inputFocused, !!error && styles.inputError]}>
        {Icon && <Icon size={18} color={focused ? colors.primary600 : colors.muted400} style={styles.inputIcon} />}
        <TextInput
          placeholderTextColor={colors.muted400}
          {...props}
          secureTextEntry={hidden}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
          style={[styles.input, style]}
        />
        {secureTextEntry && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            {hidden ? <Eye size={20} color={colors.muted500} /> : <EyeOff size={20} color={colors.muted500} />}
          </Pressable>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : typeof hint === 'string' ? <Text style={styles.hint}>{hint}</Text> : hint || null}
    </View>
  );
};

export const Banner: React.FC<{ tone?: 'error' | 'info' | 'success'; text: string }> = ({ tone = 'error', text }) => (
  <View style={[styles.banner, tone === 'error' ? styles.bannerError : tone === 'success' ? styles.bannerSuccess : styles.bannerInfo]}>
    <Text style={{ color: tone === 'error' ? colors.danger600 : tone === 'success' ? colors.success700 : colors.primary800, fontSize: 14 }}>{text}</Text>
  </View>
);

export const Empty: React.FC<{ icon: LucideIcon; title: string; text?: string; children?: React.ReactNode }> = ({ icon: Icon, title, text, children }) => (
  <View style={styles.empty}>
    <View style={styles.emptyIcon}><Icon size={30} color={colors.primary700} strokeWidth={1.75} /></View>
    <Text style={styles.emptyTitle}>{title}</Text>
    {text && <Text style={styles.emptyText}>{text}</Text>}
    {children}
  </View>
);

export const Divider = () => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.muted200 }} />;

const styles = StyleSheet.create({
  button: { minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: space(4), alignItems: 'center', justifyContent: 'center' },
  raised: { shadowColor: colors.primary700, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  compact: { minHeight: 38, paddingHorizontal: space(3) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  buttonText: { fontSize: 15, fontWeight: '700' },
  field: { marginBottom: space(4) },
  label: { fontSize: 12, fontWeight: '700', color: colors.muted500, marginBottom: space(1.5) },
  inputBox: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.muted200,
    borderRadius: 12, backgroundColor: colors.white, paddingHorizontal: space(3.5),
  },
  inputIcon: { marginRight: space(2.5) },
  inputFocused: { borderColor: colors.primary500 },
  inputError: { borderColor: colors.danger500 },
  input: { flex: 1, minHeight: 48, fontSize: 16, color: colors.muted900 },
  error: { marginTop: space(1), fontSize: 13, color: colors.danger600 },
  hint: { marginTop: space(1), fontSize: 12, color: colors.muted500 },
  banner: { padding: space(3), borderRadius: radius.md, marginBottom: space(4), borderWidth: 1 },
  bannerError: { backgroundColor: colors.danger50, borderColor: '#ecc6cc' },
  bannerInfo: { backgroundColor: colors.primary50, borderColor: colors.primary200 },
  bannerSuccess: { backgroundColor: colors.success50, borderColor: '#bbf7d0' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(8) },
  emptyIcon: { width: 72, height: 72, borderRadius: 22, backgroundColor: colors.primary50, alignItems: 'center', justifyContent: 'center', marginBottom: space(4) },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.muted900, textAlign: 'center' },
  emptyText: { marginTop: space(1.5), fontSize: 14, color: colors.muted500, textAlign: 'center' },
});
