// src/components/Dialog.tsx
// The app's own alert dialog, in place of the system's Alert.alert: same call shape
// (title, message, buttons), styled like the rest of the app. <DialogHost /> sits once at the root.
//
//   showAlert('Saved to Downloads', name);
//   showAlert('Log out?', 'You can sign in again any time.', [
//     { text: 'Cancel', style: 'cancel' },
//     { text: 'Log out', style: 'destructive', onPress: logout },
//   ]);

import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, CheckCircle2, Info, LucideIcon } from 'lucide-react-native';
import { colors, radius, space } from '../theme';

export interface DialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export type DialogTone = 'info' | 'success' | 'warning';

interface Dialog {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
  tone: DialogTone;
  dismissable: boolean;
}

let queue: Dialog[] = [];
let nextId = 1;
const listeners = new Set<(q: Dialog[]) => void>();
const emit = () => listeners.forEach((l) => l(queue));

const SUCCESS_TITLE = /^(saved|done|linked|device linked|verified|sent|copied)\b/i;

/** Show a dialog. Same arguments as React Native's Alert.alert (the options' `cancelable` too). */
export function showAlert(title: string, message?: string, buttons?: DialogButton[], options?: { cancelable?: boolean; tone?: DialogTone }): void {
  const list = buttons?.length ? buttons : [{ text: 'OK' }];
  const tone = options?.tone
    || (list.some((b) => b.style === 'destructive') ? 'warning' : SUCCESS_TITLE.test(title) ? 'success' : 'info');
  queue = [...queue, { id: nextId++, title, message, buttons: list, tone, dismissable: options?.cancelable ?? list.length <= 1 }];
  emit();
}

const close = (id: number) => {
  queue = queue.filter((d) => d.id !== id);
  emit();
};

const ICONS: Record<DialogTone, { icon: LucideIcon; color: string; bg: string }> = {
  info: { icon: Info, color: colors.primary700, bg: colors.primary50 },
  success: { icon: CheckCircle2, color: colors.success700, bg: '#ecfdf3' },
  warning: { icon: AlertTriangle, color: colors.warning700, bg: colors.warning50 },
};

export const DialogHost: React.FC = () => {
  const [dialogs, setDialogs] = useState<Dialog[]>(queue);
  useEffect(() => {
    listeners.add(setDialogs);
    return () => { listeners.delete(setDialogs); };
  }, []);
  const d = dialogs[0];
  if (!d) return null;
  const { icon: Icon, color, bg } = ICONS[d.tone];
  const press = (b: DialogButton) => {
    close(d.id);
    b.onPress?.();
  };
  const cancel = d.buttons.find((b) => b.style === 'cancel');
  // Two buttons side by side; three or more stacked, the main one first
  const stacked = d.buttons.length > 2;
  const ordered = stacked ? [...d.buttons.filter((b) => b.style !== 'cancel'), ...(cancel ? [cancel] : [])] : d.buttons;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => (cancel ? press(cancel) : d.dismissable && close(d.id))}>
      <Pressable style={styles.backdrop} onPress={() => (d.dismissable ? close(d.id) : cancel && press(cancel))}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()} accessibilityRole="alert">
          <View style={[styles.iconWrap, { backgroundColor: bg }]}><Icon size={22} color={color} /></View>
          <Text style={styles.title}>{d.title}</Text>
          {!!d.message && <Text style={styles.message}>{d.message}</Text>}
          <View style={[styles.buttons, stacked && styles.buttonsStacked]}>
            {ordered.map((b, i) => {
              const primary = b.style !== 'cancel' && (stacked ? i === 0 : i === ordered.length - 1);
              const destructive = b.style === 'destructive';
              return (
                <Pressable
                  key={`${b.text}-${i}`}
                  onPress={() => press(b)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.button,
                    !stacked && styles.buttonFlex,
                    primary ? (destructive ? styles.danger : styles.primary) : styles.secondary,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={[styles.buttonText, primary ? styles.buttonTextPrimary : destructive ? { color: colors.danger600 } : null]}>{b.text}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: space(6) },
  card: { width: '100%', maxWidth: 380, backgroundColor: colors.white, borderRadius: radius.xl, padding: space(5), alignItems: 'center' },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: space(3) },
  title: { fontSize: 17, fontWeight: '700', color: colors.muted900, textAlign: 'center' },
  message: { marginTop: space(2), fontSize: 14, lineHeight: 20, color: colors.muted600, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: space(2), marginTop: space(5), alignSelf: 'stretch' },
  buttonsStacked: { flexDirection: 'column' },
  button: { minHeight: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(3) },
  buttonFlex: { flex: 1 },
  primary: { backgroundColor: colors.primary700 },
  danger: { backgroundColor: colors.danger600 },
  secondary: { backgroundColor: colors.muted100 },
  buttonText: { fontSize: 15, fontWeight: '600', color: colors.muted700 },
  buttonTextPrimary: { color: colors.white },
});
