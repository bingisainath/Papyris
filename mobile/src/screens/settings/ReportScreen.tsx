// src/screens/settings/ReportScreen.tsx
// Report a person, a message or a group to the ShareEven team, and optionally block the person.
// Encrypted messages can't be read by the server, so a reported message's text reaches the team
// only if the reporter chooses to share it here.
import React, { useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Flag } from 'lucide-react-native';
import { errorMessage } from '../../api/client';
import { REPORT_REASONS, safetyApi } from '../../api/safety';
import type { ReportReason } from '../../api/safety';
import { Banner, Button, TextField } from '../../components/common/ui';
import { showAlert } from '../../components/common/Dialog';
import { useChat } from '../../store/chat';
import type { AppStackParams } from '../../navigation/types';
import { colors, radius, space } from '../../theme';

type Props = NativeStackScreenProps<AppStackParams, 'Report'>;

const ReportScreen: React.FC<Props> = ({ route, navigation }) => {
  const target = route.params;
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [shareText, setShareText] = useState(!!target.messageText);
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => navigation.setOptions({ title: target.title }), [navigation, target.title]);

  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      const result = await safetyApi.report({
        user_id: target.userId, conversation_id: target.conversationId, message_id: target.messageId,
        reason, details: details.trim() || undefined,
        evidence: shareText && target.messageText ? target.messageText : undefined,
        block: alsoBlock && !!target.userId,
      });
      if (result.blocked && target.userId) useChat.getState().setBlocked(target.userId, true);
      navigation.goBack();
      showAlert(result.blocked ? `Reported and blocked ${target.userName || 'them'}` : 'Report sent', "Thanks, we'll look into it.");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.head}>
        <View style={styles.headIcon}><Flag size={20} color={colors.danger600} /></View>
        <Text style={styles.lead}>The ShareEven team reviews reports.{target.userName ? ` ${target.userName} isn't told.` : ''}</Text>
      </View>

      <Text style={styles.label}>What's wrong?</Text>
      {REPORT_REASONS.map((r) => {
        const on = reason === r.value;
        return (
          <Pressable key={r.value} onPress={() => setReason(r.value)} style={[styles.reason, on && styles.reasonOn]}
            accessibilityRole="radio" accessibilityState={{ checked: on }}>
            <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
            <Text style={styles.reasonText}>{r.label}</Text>
          </Pressable>
        );
      })}

      <View style={{ height: space(3) }} />
      <TextField label="Anything else? (optional)" value={details} onChangeText={setDetails} multiline maxLength={1000}
        style={{ minHeight: 80, textAlignVertical: 'top' }} />

      {!!target.messageText && (
        <Toggle value={shareText} onChange={setShareText} title="Share this message's text with the ShareEven team"
          hint="Messages are end-to-end encrypted, so the team can only see it if you share it." />
      )}
      {!!target.userId && (
        <Toggle value={alsoBlock} onChange={setAlsoBlock} title={`Also block ${target.userName || 'this person'}`}
          hint="They can't message you directly or add you to groups." />
      )}

      {error && <Banner text={error} />}
      <Button title="Send report" icon={Flag} variant="danger" onPress={submit} loading={busy} disabled={!reason} />
    </ScrollView>
  );
};

const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void; title: string; hint: string }> = ({ value, onChange, title, hint }) => (
  <View style={styles.toggle}>
    <View style={{ flex: 1 }}>
      <Text style={styles.toggleTitle}>{title}</Text>
      <Text style={styles.toggleHint}>{hint}</Text>
    </View>
    <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary300 }} thumbColor={value ? colors.primary700 : undefined} />
  </View>
);

const styles = StyleSheet.create({
  content: { padding: space(5), paddingBottom: space(10), backgroundColor: colors.background, flexGrow: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginBottom: space(4) },
  headIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger50 },
  lead: { flex: 1, fontSize: 13, color: colors.muted500 },
  label: { fontSize: 12, fontWeight: '700', color: colors.muted500, marginBottom: space(2) },
  reason: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(3), paddingVertical: space(3),
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.muted200, backgroundColor: colors.white, marginBottom: space(2) },
  reasonOn: { borderColor: colors.danger600, backgroundColor: colors.danger50 },
  reasonText: { flex: 1, fontSize: 15, color: colors.muted900 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.muted400, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.danger600 },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger600 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginBottom: space(4) },
  toggleTitle: { fontSize: 15, color: colors.muted900 },
  toggleHint: { fontSize: 12, color: colors.muted500, marginTop: 2 },
});

export default ReportScreen;
