// src/screens/settings/ReceiptScanningScreen.tsx
// Receipt scanning: free scans left this month, which AI model reads receipts, and optional own API keys.
// Keys are write-only: they go to the server, are stored encrypted there, and only "…abcd" ever comes back.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, KeyRound } from 'lucide-react-native';
import { expenseService } from '../../api/expenses';
import type { AISettings } from '../../api/expenses';
import { errorMessage } from '../../api/client';
import { Button, Divider, TextField } from '../../components/ui';
import { useKeyboardOffset } from '../../hooks/useKeyboardOffset';
import { colors, radius, space } from '../../theme';

type Provider = 'anthropic' | 'openai';
const PROVIDERS: { id: Provider; name: string; hint: string; url: string }[] = [
  { id: 'anthropic', name: 'Claude (Anthropic)', hint: 'sk-ant-…', url: 'https://console.anthropic.com/settings/keys' },
  { id: 'openai', name: 'OpenAI', hint: 'sk-…', url: 'https://platform.openai.com/api-keys' },
];

const ReceiptScanningScreen: React.FC = () => {
  const keyboard = useKeyboardOffset();
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [draft, setDraft] = useState<{ provider: Provider; value: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    expenseService.aiSettings().then(setSettings).catch((e) => Alert.alert("Couldn't load", errorMessage(e)));
  }, []);

  const run = async (action: () => Promise<AISettings>) => {
    setBusy(true);
    try {
      setSettings(await action());
      return true;
    } catch (e) {
      Alert.alert("Couldn't save", errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!settings) return <View style={styles.center}><ActivityIndicator color={colors.primary700} /></View>;
  const fallback = settings.models.find((m) => m.is_default)?.label || 'none';
  const choices = [{ id: null as number | null, label: `App default (${fallback})`, available: true }, ...settings.models.map((m) => ({ id: m.id as number | null, label: m.label, available: !!m.available }))];

  return (
    <View ref={keyboard.ref} style={[styles.flex, { paddingBottom: keyboard.offset }]}>
      <ScrollView style={styles.flex} contentContainerStyle={{ paddingBottom: space(10) }} keyboardShouldPersistTaps="handled">
        <View style={styles.usage}>
          <Text style={styles.usageNumber}>{Math.max(0, settings.usage.monthly_limit - settings.usage.scans_this_month)}</Text>
          <Text style={styles.usageText}>
            free scans left this month ({settings.usage.scans_this_month} of {settings.usage.monthly_limit} used). Scans with your own key don't count.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>AI model</Text>
        <View style={styles.section}>
          {choices.map((c, i) => {
            const selected = settings.preferred_model_id === c.id;
            return (
              <View key={String(c.id)}>
                {i > 0 && <Divider />}
                <Pressable
                  disabled={busy || !c.available || selected}
                  onPress={() => run(() => expenseService.setPreferredModel(c.id))}
                  style={({ pressed }) => [styles.choice, pressed && { backgroundColor: colors.muted50 }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled: !c.available }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.choiceText, !c.available && { color: colors.muted400 }]}>{c.label}</Text>
                    {!c.available && <Text style={styles.hint}>Add a key below to use it</Text>}
                  </View>
                  {selected && <Check size={20} color={colors.primary700} />}
                </Pressable>
              </View>
            );
          })}
        </View>
        <Text style={styles.note}>A group admin can also pick a model for one chat.</Text>

        <Text style={styles.sectionTitle}>Your own API keys (optional)</Text>
        <View style={styles.section}>
          {PROVIDERS.map((p, i) => {
            const saved = settings.keys[p.id];
            const editing = draft?.provider === p.id;
            return (
              <View key={p.id}>
                {i > 0 && <Divider />}
                <View style={styles.keyRow}>
                  <KeyRound size={20} color={colors.primary700} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.choiceText}>{p.name}</Text>
                    <Text style={styles.hint}>{saved ? `Saved key ${saved}` : 'Not added'}</Text>
                  </View>
                  {saved ? (
                    <Pressable disabled={busy} hitSlop={8} onPress={() => Alert.alert(`Remove your ${p.name} key?`, 'Scans will use the app\'s free allowance again.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => run(() => expenseService.removeOwnKey(p.id)) },
                    ])}>
                      <Text style={styles.remove}>Remove</Text>
                    </Pressable>
                  ) : !editing && (
                    <Pressable hitSlop={8} onPress={() => setDraft({ provider: p.id, value: '' })}><Text style={styles.add}>Add key</Text></Pressable>
                  )}
                </View>
                {editing && (
                  <View style={styles.keyForm}>
                    <TextField
                      value={draft!.value}
                      onChangeText={(value) => setDraft({ provider: p.id, value })}
                      placeholder={p.hint}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                      accessibilityLabel={`${p.name} API key`}
                      hint="Stored encrypted, used only on our server, and billed to your account."
                    />
                    <Pressable onPress={() => Linking.openURL(p.url)}><Text style={styles.link}>Create a key at {p.url.replace('https://', '')}</Text></Pressable>
                    <View style={styles.buttons}>
                      <Button title="Cancel" variant="secondary" compact onPress={() => setDraft(null)} />
                      <Button title="Save key" compact loading={busy} disabled={draft!.value.trim().length < 20}
                        onPress={async () => { if (await run(() => expenseService.setOwnKey(p.id, draft!.value.trim()))) setDraft(null); }} />
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
        {settings.is_app_admin && <Text style={styles.note}>App admin: models and the monthly limit are managed in the web app's Settings.</Text>}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  usage: { flexDirection: 'row', alignItems: 'center', gap: space(4), margin: space(4), padding: space(4), borderRadius: radius.lg, backgroundColor: colors.primary50 },
  usageNumber: { fontSize: 32, fontWeight: '700', color: colors.primary800 },
  usageText: { flex: 1, fontSize: 13, color: colors.primary800 },
  sectionTitle: { paddingHorizontal: space(4), paddingTop: space(3), paddingBottom: space(2), fontSize: 12, fontWeight: '700', color: colors.muted500, textTransform: 'uppercase', letterSpacing: 0.5 },
  section: { backgroundColor: colors.white },
  choice: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(3.5) },
  choiceText: { fontSize: 15, color: colors.muted900 },
  hint: { fontSize: 12, color: colors.muted500, marginTop: 1 },
  note: { paddingHorizontal: space(4), paddingTop: space(2), fontSize: 12, color: colors.muted500 },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: space(4), paddingHorizontal: space(4), paddingVertical: space(3.5) },
  keyForm: { paddingHorizontal: space(4), paddingBottom: space(4) },
  link: { fontSize: 13, color: colors.primary700, textDecorationLine: 'underline', marginTop: space(1) },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: space(2), marginTop: space(3) },
  remove: { color: colors.danger600, fontWeight: '600' },
  add: { color: colors.primary700, fontWeight: '600' },
});

export default ReceiptScanningScreen;
