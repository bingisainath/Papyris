// src/components/settings/SettingsUI.tsx
// The building blocks every Settings page shares, so they all look like the Figma design
// (developement/…/src/index.css: .card, .settings-list, .setting-icon, .mini-badge, .security-banner).
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, space } from '../../theme';

export type Badge = { text: string; tone: 'good' | 'off' | 'tint' | 'warn' };

/** A settings sub-page: scrolls, grey canvas, the design's side and bottom spacing. */
export const SettingsPage: React.FC<{ children: React.ReactNode; intro?: string }> = ({ children, intro }) => (
  <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
    {!!intro && <Text style={styles.intro}>{intro}</Text>}
    {children}
  </ScrollView>
);

export const SettingsCard: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ children, style }) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const SettingsLabel: React.FC<{ text: string }> = ({ text }) => <Text style={styles.label}>{text.toUpperCase()}</Text>;

/** One row: tinted icon, title, grey hint, optional badge, chevron when it opens something. */
export const SettingsRow: React.FC<{
  icon: LucideIcon;
  label: string;
  hint?: string;
  badge?: Badge;
  danger?: boolean;
  first?: boolean;
  /** A control on the right instead of the chevron (e.g. a switch). */
  right?: React.ReactNode;
  onPress?: () => void;
}> = ({ icon: Icon, label, hint, badge, danger, first, right, onPress }) => (
  <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={badge ? `${label}, ${badge.text}` : label}
    style={({ pressed }) => [styles.row, !first && styles.rowBorder, pressed && styles.pressed]}>
    <View style={[styles.rowIcon, danger && { backgroundColor: colors.danger50 }]}>
      <Icon size={20} color={danger ? colors.danger600 : colors.primary700} />
    </View>
    <View style={styles.rowText}>
      <Text style={[styles.rowLabel, danger && { color: colors.danger600 }]} numberOfLines={1}>{label}</Text>
      {!!hint && <Text style={styles.rowHint} numberOfLines={3}>{hint}</Text>}
    </View>
    {badge && <Text style={[styles.badge, styles[badge.tone]]}>{badge.text}</Text>}
    {right ?? (onPress && <ChevronRight size={16} color={colors.muted400} />)}
  </Pressable>
);

/** A short explanation inside a card (icon, title, text). */
export const SettingsNote: React.FC<{ icon: LucideIcon; title: string; text: string; style?: StyleProp<ViewStyle> }> = ({ icon: Icon, title, text, style }) => (
  <View style={[styles.note, style]}>
    <Icon size={20} color={colors.primary700} />
    <View style={styles.noteText}>
      <Text style={styles.noteTitle}>{title}</Text>
      <Text style={styles.noteSub}>{text}</Text>
    </View>
  </View>
);

export const settingsStyles = StyleSheet.create({
  pressed: { backgroundColor: colors.primary50 },
});

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  pageContent: { paddingHorizontal: space(4), paddingTop: 18, paddingBottom: space(10) },
  intro: { fontSize: 13, lineHeight: 19, color: colors.muted500, marginBottom: 14, marginHorizontal: 4 },
  card: {
    backgroundColor: colors.white, borderRadius: 17, borderWidth: 1, borderColor: colors.muted200, overflow: 'hidden',
    shadowColor: '#1a1425', shadowOpacity: 0.035, shadowRadius: 14, shadowOffset: { width: 0, height: 3 }, elevation: 1,
  },
  label: { marginTop: 22, marginBottom: 8, marginLeft: 4, fontSize: 11, fontWeight: '700', letterSpacing: 1.3, color: colors.muted500 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 64 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.muted200 },
  pressed: { backgroundColor: colors.primary50 },
  rowIcon: { width: 40, height: 40, borderRadius: 11, backgroundColor: colors.primary50, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  rowLabel: { fontSize: 14, fontWeight: '700', color: colors.muted900 },
  rowHint: { fontSize: 12, lineHeight: 16, color: colors.muted500 },
  badge: { fontSize: 10, fontWeight: '700', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10, overflow: 'hidden' },
  good: { backgroundColor: '#eaf7ee', color: colors.success600 },
  off: { backgroundColor: colors.muted100, color: colors.muted500 },
  tint: { backgroundColor: colors.primary100, color: colors.primary700 },
  warn: { backgroundColor: colors.warning50, color: colors.warning700 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 15, backgroundColor: colors.primary100 },
  noteText: { flex: 1, gap: 3 },
  noteTitle: { fontSize: 14, fontWeight: '700', color: colors.primary700 },
  noteSub: { fontSize: 12, lineHeight: 17, color: colors.primary700 },
});
