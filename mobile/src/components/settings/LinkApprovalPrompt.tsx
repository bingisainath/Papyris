// src/components/settings/LinkApprovalPrompt.tsx
// "Is this you?": when a new phone or browser signs in to this account and asks to be linked, every
// linked device shows this (same as web/src/components/organisms/LinkApprovalPrompt.tsx). Picking the
// number shown on the new device approves it in one tap; a wrong number or "Not me" turns it down.
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { MonitorSmartphone } from 'lucide-react-native';
import { pendingApprovals } from '../../crypto/v2-platform/link';
import type { LinkApproval } from '../../crypto/v2-platform/link';
import { errorMessage } from '../../api/client';
import { socket } from '../../websocket/socket';
import { showAlert } from '../common/Dialog';
import { colors, radius, space } from '../../theme';

const EVENTS = new Set(['e2e_link_request', 'e2e_link_denied', 'e2e_link_granted']);

const LinkApprovalPrompt: React.FC<{ userId: string }> = ({ userId }) => {
  const [waiting, setWaiting] = useState<LinkApproval[]>([]);
  const [sendHistory, setSendHistory] = useState(true);
  const [busy, setBusy] = useState(false);
  // "Not now": closed on this phone only (to approve with the code instead, or decide elsewhere)
  const [closed, setClosed] = useState<Set<string>>(() => new Set());

  const refresh = useCallback(() => {
    pendingApprovals(userId).then(setWaiting).catch(() => undefined);
  }, [userId]);

  useEffect(() => {
    refresh();
    const offSocket = socket.on((e) => { if (EVENTS.has(e.type)) refresh(); });
    // Opened from the notification, or back from the background: check again
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { offSocket(); sub.remove(); };
  }, [refresh]);

  const current = waiting.find((w) => !closed.has(w.id));
  if (!current) return null;

  const run = async (action: () => Promise<boolean | void>) => {
    setBusy(true);
    try {
      const outcome = await action();
      if (outcome === true) showAlert(`${current.name} is linked`);
      else if (outcome === false) showAlert('Turned down', `That wasn't the number on ${current.name}. If it was you, start again on the new device.`);
    } catch (e) {
      showAlert("Couldn't do that", errorMessage(e));
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setClosed((c) => new Set(c).add(current.id))}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.icon}><MonitorSmartphone size={26} color={colors.primary700} /></View>
          <Text style={styles.title} accessibilityRole="header">Is this you?</Text>
          <Text style={styles.text}>
            <Text style={styles.bold}>{current.name}</Text> wants to read your encrypted chats. Only continue if you're signing in on it right now.
          </Text>
          <Text style={styles.label}>TAP THE NUMBER SHOWN ON {current.name.toUpperCase()}</Text>
          <View style={styles.choices}>
            {current.choices.map((n) => (
              <Pressable key={n} disabled={busy} onPress={() => run(() => current.answer(n, sendHistory))}
                style={({ pressed }) => [styles.choice, pressed && styles.choicePressed, busy && { opacity: 0.5 }]}
                accessibilityRole="button" accessibilityLabel={`${n}`}>
                <Text style={styles.choiceText}>{n}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.history} onPress={() => setSendHistory((v) => !v)}>
            <Switch value={sendHistory} onValueChange={setSendHistory} trackColor={{ true: colors.primary600, false: colors.muted300 }} thumbColor={colors.white} />
            <Text style={styles.historyText}>Send my message history (encrypted so only that device can open it)</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={() => run(async () => { await current.deny(); })}
            style={({ pressed }) => [styles.deny, pressed && { opacity: 0.8 }]} accessibilityRole="button">
            <Text style={styles.denyText}>{busy ? 'Working…' : 'Not me'}</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={() => setClosed((c) => new Set(c).add(current.id))}
            style={({ pressed }) => [styles.later, pressed && { opacity: 0.6 }]} accessibilityRole="button">
            <Text style={styles.laterText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(24,18,31,0.6)', alignItems: 'center', justifyContent: 'center', padding: space(5) },
  card: { width: '100%', maxWidth: 380, backgroundColor: colors.white, borderRadius: 22, padding: space(6), alignItems: 'center' },
  icon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primary50, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: space(4), fontSize: 22, fontWeight: '700', color: colors.muted900 },
  text: { marginTop: space(2), fontSize: 14, lineHeight: 20, color: colors.muted600, textAlign: 'center' },
  bold: { fontWeight: '700', color: colors.muted900 },
  label: { marginTop: space(5), fontSize: 11, fontWeight: '700', letterSpacing: 0.6, color: colors.muted500, textAlign: 'center' },
  choices: { flexDirection: 'row', gap: space(3), marginTop: space(3) },
  choice: { flex: 1, height: 68, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.primary100, backgroundColor: colors.primary50,
    alignItems: 'center', justifyContent: 'center' },
  choicePressed: { borderColor: colors.primary500, backgroundColor: colors.primary100 },
  choiceText: { fontSize: 30, fontWeight: '800', color: colors.primary700, fontVariant: ['tabular-nums'] },
  history: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(5), alignSelf: 'stretch' },
  historyText: { flex: 1, fontSize: 13, color: colors.muted700 },
  deny: { marginTop: space(5), alignSelf: 'stretch', height: 46, borderRadius: radius.md, backgroundColor: colors.danger50,
    alignItems: 'center', justifyContent: 'center' },
  denyText: { fontSize: 15, fontWeight: '700', color: colors.danger600 },
  later: { marginTop: space(2), alignSelf: 'stretch', height: 42, alignItems: 'center', justifyContent: 'center' },
  laterText: { fontSize: 14, fontWeight: '600', color: colors.muted600 },
});

export default LinkApprovalPrompt;
