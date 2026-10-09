// src/screens/settings/StoreDiscountsScreen.tsx
// Your store discounts (e.g. a staff discount at one shop). When a scanned receipt is from that store
// and the discount isn't printed on it, it's added switched off so you can turn it on.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Plus, Store } from 'lucide-react-native';
import { expenseService } from '../../api/expenses';
import type { StoreDiscount } from '../../api/expenses';
import { errorMessage } from '../../api/client';
import { Button, Divider, Empty, TextField } from '../../components/ui';
import { useKeyboardOffset } from '../../hooks/useKeyboardOffset';
import { colors, radius, space } from '../../theme';
import { showAlert } from '../../components/Dialog';

type Draft = { id?: number; store_name: string; percent: string; excluded: string; stacks_with_reduced: boolean; active: boolean };
const emptyDraft: Draft = { store_name: '', percent: '10', excluded: '', stacks_with_reduced: false, active: true };

const StoreDiscountsScreen: React.FC = () => {
  const keyboard = useKeyboardOffset();
  const [rules, setRules] = useState<StoreDiscount[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    expenseService.storeDiscounts().then(setRules).catch((e) => showAlert("Couldn't load", errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  const body = (d: Draft) => ({
    store_name: d.store_name.trim(),
    percent: d.percent.replace(',', '.').trim(),
    excluded_categories: d.excluded.split(',').map((s) => s.trim()).filter(Boolean),
    stacks_with_reduced: d.stacks_with_reduced,
    active: d.active,
  });

  const save = async () => {
    if (!draft) return;
    const percent = Number(draft.percent.replace(',', '.'));
    if (draft.store_name.trim().length < 2) return setError('Enter the store name');
    if (!(percent > 0 && percent <= 100)) return setError('Enter a percentage between 0 and 100');
    setSaving(true);
    try {
      await expenseService.saveStoreDiscount(body(draft), draft.id);
      setDraft(null);
      load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const toggle = (r: StoreDiscount, active: boolean) => {
    setRules((list) => list?.map((x) => (x.id === r.id ? { ...x, active } : x)) || null);
    expenseService.saveStoreDiscount({ ...r, active }, r.id).catch((e) => { showAlert("Couldn't save", errorMessage(e)); load(); });
  };

  const remove = (id: number, name: string) => showAlert(`Delete the ${name} discount?`, undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { setDraft(null); expenseService.deleteStoreDiscount(id).then(load).catch((e) => showAlert("Couldn't delete", errorMessage(e))); } },
  ]);

  if (!rules) return <View style={styles.center}><ActivityIndicator color={colors.primary700} /></View>;

  return (
    <View ref={keyboard.ref} style={[styles.flex, { paddingBottom: keyboard.offset }]}>
      <ScrollView style={styles.flex} contentContainerStyle={{ paddingBottom: space(10) }} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          E.g. a staff or member discount at one shop. When it isn't printed on a receipt from that store, it's added switched off so you can turn it on.
        </Text>

        {draft ? (
          <View style={styles.form}>
            <Text style={styles.formTitle}>{draft.id ? 'Edit discount' : 'New discount'}</Text>
            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <TextField label="Store" value={draft.store_name} placeholder="e.g. Tesco" autoFocus={!draft.id}
                  onChangeText={(store_name) => { setDraft({ ...draft, store_name }); setError(null); }} />
              </View>
              <View style={{ width: 96 }}>
                <TextField label="Percent" value={draft.percent} keyboardType="decimal-pad" style={{ textAlign: 'right' }}
                  onChangeText={(percent) => { setDraft({ ...draft, percent }); setError(null); }} />
              </View>
            </View>
            <TextField label="Not on (optional)" value={draft.excluded} placeholder="Categories, comma separated, e.g. alcohol"
              onChangeText={(excluded) => setDraft({ ...draft, excluded })} />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Also on reduced / already discounted items</Text>
              <Switch value={draft.stacks_with_reduced} onValueChange={(v) => setDraft({ ...draft, stacks_with_reduced: v })}
                trackColor={{ true: colors.primary600, false: colors.muted300 }} thumbColor={colors.white} />
            </View>
            {error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.buttons}>
              {draft.id !== undefined && (
                <Pressable onPress={() => remove(draft.id!, draft.store_name)} hitSlop={8} style={{ marginRight: 'auto' }}>
                  <Text style={styles.delete}>Delete</Text>
                </Pressable>
              )}
              <Button title="Cancel" variant="secondary" compact onPress={() => { setDraft(null); setError(null); }} />
              <Button title="Save" compact loading={saving} onPress={save} />
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setDraft(emptyDraft)} style={({ pressed }) => [styles.addRow, pressed && { backgroundColor: colors.muted50 }]}>
            <Plus size={20} color={colors.primary700} />
            <Text style={styles.addText}>Add a store discount</Text>
          </Pressable>
        )}

        {rules.length === 0 && !draft ? (
          <Empty icon={Store} title="No store discounts" text="Add one and it will be suggested on receipts from that store." />
        ) : rules.length > 0 && (
          <View style={styles.list}>
            {rules.map((r, i) => (
              <View key={r.id}>
                {i > 0 && <Divider />}
                <Pressable
                  onPress={() => { setError(null); setDraft({ id: r.id, store_name: r.store_name, percent: r.percent, excluded: r.excluded_categories.join(', '), stacks_with_reduced: r.stacks_with_reduced, active: r.active }); }}
                  style={({ pressed }) => [styles.rule, pressed && { backgroundColor: colors.muted50 }]}
                  accessibilityHint="Opens the discount for editing"
                >
                  <Store size={20} color={colors.primary700} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ruleName}>{r.store_name} · {Number(r.percent)}%</Text>
                    <Text style={styles.ruleHint}>
                      {r.stacks_with_reduced ? 'Also on reduced items' : 'Not on reduced items'}
                      {r.excluded_categories.length > 0 ? ` · not on ${r.excluded_categories.join(', ')}` : ''}
                    </Text>
                  </View>
                  <Switch value={r.active} onValueChange={(v) => toggle(r, v)} accessibilityLabel={`${r.store_name} discount active`}
                    trackColor={{ true: colors.primary600, false: colors.muted300 }} thumbColor={colors.white} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  intro: { padding: space(4), fontSize: 13, color: colors.muted600 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space(4), paddingHorizontal: space(4), paddingVertical: space(3.5), backgroundColor: colors.white },
  addText: { fontSize: 15, color: colors.primary700, fontWeight: '600' },
  form: { padding: space(4), backgroundColor: colors.white, gap: space(1) },
  formTitle: { fontSize: 16, fontWeight: '700', color: colors.muted900, marginBottom: space(2) },
  formRow: { flexDirection: 'row', gap: space(3) },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(2) },
  switchLabel: { flex: 1, fontSize: 14, color: colors.muted700 },
  error: { fontSize: 13, color: colors.danger600 },
  buttons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space(2), marginTop: space(2) },
  delete: { color: colors.danger600, fontWeight: '600' },
  list: { marginTop: space(3), backgroundColor: colors.white, borderRadius: radius.sm },
  rule: { flexDirection: 'row', alignItems: 'center', gap: space(4), paddingHorizontal: space(4), paddingVertical: space(3) },
  ruleName: { fontSize: 15, color: colors.muted900, fontWeight: '500' },
  ruleHint: { fontSize: 12, color: colors.muted500, marginTop: 1 },
});

export default StoreDiscountsScreen;
