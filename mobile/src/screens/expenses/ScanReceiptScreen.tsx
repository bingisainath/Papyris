// src/screens/expenses/ScanReceiptScreen.tsx
// Photograph a receipt -> the server's AI reads it -> tap who each item is for -> save.
// Same flow and rules as web/src/components/expenses/ReceiptScan.tsx + ReceiptReview.tsx.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Asset, launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { Camera, Images, X } from 'lucide-react-native';
import Avatar from '../../components/Avatar';
import { Banner, Button } from '../../components/ui';
import { api, errorMessage } from '../../api/client';
import { expenseService, Receipt, ReceiptUpdate } from '../../api/expenses';
import { onServerEvent } from '../../store/chat';
import { useAuth } from '../../store/auth';
import { formatMinor, parseMajor, toMajorString } from '../../utils/money';
import { colors, radius, space } from '../../theme';
import type { AppStackParams } from '../../navigation/types';
import { memberName, useChatMoney } from './useMembers';

const MAX_PHOTOS = 4;
const DISCOUNT_KINDS = ['item_discount', 'promotion', 'store_discount', 'coupon'];
const PRESETS = [10, 15, 20];

async function uploadPhoto(asset: Asset): Promise<string> {
  const form = new FormData();
  form.append('file', { uri: asset.uri, type: asset.type || 'image/jpeg', name: asset.fileName || 'receipt.jpg' } as any);
  const r = await api.post('/media/upload', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
  return r.data.data.url as string;
}

function toDraft(r: Receipt): ReceiptUpdate {
  const currency = r.currency || 'EUR';
  return {
    store_name: r.store_name,
    currency,
    printed_total: r.printed_total_minor === null ? null : toMajorString(r.printed_total_minor, currency),
    items: r.items.map((i) => ({
      id: i.id, name: i.name, quantity: i.quantity, unit: i.unit, price: toMajorString(i.gross_minor, currency),
      category: i.category, flags: i.flags, split_mode: i.split_mode, assignments: i.assignments,
    })),
    adjustments: r.adjustments.map((a) => ({
      kind: a.kind, label: a.label, amount: toMajorString(a.amount_minor, currency), percent: a.percent, item_indexes: a.item_indexes,
      allocation: a.allocation, assignee_ids: a.assignee_ids, source: a.source, enabled: a.enabled,
    })),
    payers: r.payers.length === 1 ? [{ user_id: r.payers[0].user_id, amount: '0' }] : r.payers.length > 1
      ? r.payers.map((p) => ({ user_id: p.user_id, amount: toMajorString(p.amount_minor, currency) })) : null,
  };
}

const ScanReceiptScreen: React.FC<NativeStackScreenProps<AppStackParams, 'ScanReceipt'>> = ({ route, navigation }) => {
  const { conversationId } = route.params;
  const me = useAuth((s) => s.user)!;
  const { members } = useChatMoney(conversationId);
  const [photos, setPhotos] = useState<Asset[]>([]);
  const [stage, setStage] = useState<'pick' | 'uploading' | 'reading' | 'review'>(route.params.receiptId ? 'reading' : 'pick');
  const [receiptId, setReceiptId] = useState<string | undefined>(route.params.receiptId);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [draft, setDraft] = useState<ReceiptUpdate | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestNo = useRef(0);

  useEffect(() => navigation.setOptions({ title: stage === 'review' ? 'Who is each item for?' : 'Scan receipt' }), [navigation, stage]);

  // ---- 1. photos
  const add = async (source: 'camera' | 'library') => {
    const options = { mediaType: 'photo' as const, quality: 0.8 as const, maxWidth: 2600, maxHeight: 2600 };
    const result = source === 'camera'
      ? await launchCamera({ ...options, saveToPhotos: false })
      : await launchImageLibrary({ ...options, selectionLimit: MAX_PHOTOS - photos.length });
    if (result.errorCode) Alert.alert("Couldn't open the " + (source === 'camera' ? 'camera' : 'photos'), result.errorMessage || result.errorCode);
    if (result.assets?.length) setPhotos((p) => [...p, ...result.assets!].slice(0, MAX_PHOTOS));
  };

  const start = async () => {
    setStage('uploading');
    try {
      const urls = [];
      for (const photo of photos) urls.push(await uploadPhoto(photo));
      const created = await expenseService.scanReceipt(conversationId, urls);
      setReceiptId(created.id);
      setStage('reading');
    } catch (e) {
      Alert.alert("Couldn't start the scan", errorMessage(e));
      setStage('pick');
    }
  };

  // ---- 2. wait for the AI (WebSocket event, with a slow poll as a safety net)
  const check = useCallback(async () => {
    if (!receiptId) return;
    const r = await expenseService.getReceipt(receiptId);
    if (r.status === 'processing') return;
    setReceipt(r);
    setDraft(toDraft(r));
    setStage('review');
  }, [receiptId]);

  useEffect(() => {
    if (stage !== 'reading' || !receiptId) return;
    check().catch(() => undefined);
    const off = onServerEvent((e) => { if (e.type === 'receipt_scan_ready' && e.receiptId === receiptId) check().catch(() => undefined); });
    const poll = setInterval(() => check().catch(() => undefined), 5000);
    return () => { off(); clearInterval(poll); };
  }, [stage, receiptId, check]);

  // ---- 3. review: every change is saved and recalculated on the server
  const change = (update: (d: ReceiptUpdate) => ReceiptUpdate) => {
    setDraft((d) => {
      const next = update(d!);
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => push(next), 450);
      return next;
    });
  };

  const push = async (body: ReceiptUpdate) => {
    const mine = ++requestNo.current;
    setSyncing(true);
    try {
      const updated = await expenseService.updateReceipt(receiptId!, body);
      if (mine === requestNo.current) {
        setReceipt(updated);
        setDraft((d) => (d && d.items.length === updated.items.length ? { ...d, items: d.items.map((it, n) => ({ ...it, id: updated.items[n].id })) } : d));
      }
    } catch (e) {
      if (mine === requestNo.current) Alert.alert("Couldn't update", errorMessage(e));
    } finally {
      if (mine === requestNo.current) setSyncing(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      if (pushTimer.current) { clearTimeout(pushTimer.current); pushTimer.current = null; await push(draft!); }
      await expenseService.saveReceipt(receiptId!, { description: receipt?.store_name || undefined });
      navigation.goBack();
    } catch (e) {
      Alert.alert("Couldn't save", errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  // ---------- render
  if (stage === 'pick') {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lead}>Photograph the whole receipt, flat and well lit. Long receipt? Add up to {MAX_PHOTOS} photos, top to bottom.</Text>
        <View style={styles.thumbs}>
          {photos.map((p, i) => (
            <View key={p.uri} style={styles.thumb}>
              <Image source={{ uri: p.uri }} style={styles.thumbImage} />
              <Pressable onPress={() => setPhotos((list) => list.filter((_, n) => n !== i))} style={styles.remove} accessibilityLabel="Remove photo">
                <X size={14} color={colors.white} />
              </Pressable>
            </View>
          ))}
        </View>
        {photos.length < MAX_PHOTOS && (
          <View style={styles.pickRow}>
            <Button title="Take photo" icon={Camera} onPress={() => add('camera')} style={styles.flex} />
            <Button title="Gallery" icon={Images} variant="secondary" onPress={() => add('library')} style={styles.flex} />
          </View>
        )}
        <Button title="Read receipt" onPress={start} disabled={!photos.length} style={{ marginTop: space(4) }} />
      </ScrollView>
    );
  }

  if (stage === 'uploading' || stage === 'reading' || !receipt || !draft) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary700} />
        <Text style={styles.waitTitle}>{stage === 'uploading' ? 'Uploading…' : 'Reading the receipt…'}</Text>
        <Text style={styles.waitText}>This usually takes 10–40 seconds.</Text>
      </View>
    );
  }

  if (receipt.status === 'failed') {
    return (
      <View style={styles.center}>
        <Text style={styles.waitTitle}>Couldn’t read this receipt</Text>
        <Text style={[styles.waitText, { color: colors.danger600 }]}>{receipt.error}</Text>
        <Button title="Enter it manually" variant="secondary" onPress={() => navigation.replace('AddExpense', { conversationId })} style={{ marginTop: space(4) }} />
      </View>
    );
  }

  const currency = draft.currency;
  const totals = receipt.totals;
  const unassigned = new Set(totals?.unassigned_item_indexes || []);
  const nameOf = (id: string) => (id === me.id ? 'You' : memberName(members.find((m) => m.id === id)));
  const single = draft.payers?.length === 1 ? draft.payers[0].user_id : receipt.uploaded_by || me.id;
  const blocking = receipt.calc_error || (unassigned.size ? 'Choose who the highlighted items are for' : null);
  const difference = totals?.difference_minor;

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.store}>{receipt.store_name || 'Receipt'}</Text>
        {(receipt.warnings.length > 0 || (difference !== null && difference !== undefined && difference !== 0)) && (
          <Banner tone="info" text={[
            difference ? `Lines add up to ${formatMinor((totals!.computed_total_minor) - (totals!.outside_receipt_minor || 0), currency)}, the receipt says ${formatMinor(totals!.printed_total_minor, currency)}.` : '',
            ...receipt.warnings.filter((w) => !w.startsWith('The lines add up')),
          ].filter(Boolean).join('\n')} />
        )}

        <View style={styles.quick}>
          <Pressable onPress={() => change((d) => ({ ...d, items: d.items.map((it) => ({ ...it, split_mode: 'equal', assignments: members.map((m) => ({ user_id: m.id, value: '1' })) })) }))} style={styles.quickButton}>
            <Text style={styles.quickText}>Everyone</Text>
          </Pressable>
          <Pressable onPress={() => change((d) => ({ ...d, items: d.items.map((it) => ({ ...it, assignments: [] })) }))} style={styles.quickButton}>
            <Text style={styles.quickText}>Clear</Text>
          </Pressable>
        </View>

        {draft.items.map((item, n) => {
          const server = receipt.items[n];
          const gross = parseMajor(item.price, currency) || 0;
          const net = server?.net_minor ?? gross;
          const voided = item.flags.includes('voided');
          return (
            <View key={n} style={[styles.item, unassigned.has(n) && styles.itemMissing, voided && { opacity: 0.5 }]}>
              <View style={styles.itemTop}>
                <View style={styles.flex}>
                  <Text style={[styles.itemName, voided && { textDecorationLine: 'line-through' }]}>{item.quantity !== '1' ? `${item.quantity}× ` : ''}{item.name}</Text>
                  {item.flags.includes('reduced') && <Text style={styles.flag}>Reduced</Text>}
                  {server?.suggestion && <Text style={styles.suggestion}>{server.suggestion}</Text>}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {net !== gross && <Text style={styles.strike}>{formatMinor(gross, currency)}</Text>}
                  <Text style={styles.price}>{formatMinor(net, currency)}</Text>
                </View>
              </View>
              {!voided && (
                <View style={styles.people}>
                  {members.map((m) => {
                    const on = item.assignments.some((a) => a.user_id === m.id);
                    return (
                      <Pressable key={m.id} onPress={() => change((d) => ({
                        ...d,
                        items: d.items.map((it, i) => (i !== n ? it : {
                          ...it,
                          assignments: on ? it.assignments.filter((a) => a.user_id !== m.id) : [...it.assignments, { user_id: m.id, value: '1' }],
                        })),
                      }))} style={[styles.personToggle, !on && styles.personOff]} accessibilityState={{ selected: on }} accessibilityLabel={`${nameOf(m.id)} for ${item.name}`}>
                        <View style={[styles.ring, on && styles.ringOn]}><Avatar uri={m.avatar} name={memberName(m)} size={30} /></View>
                        <Text style={styles.personLabel} numberOfLines={1}>{nameOf(m.id).split(' ')[0]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {draft.adjustments.some((a) => !(a.item_indexes.length === 1 && DISCOUNT_KINDS.includes(a.kind) && a.source === 'printed')) && (
          <Text style={styles.section}>Discounts, tax and fees</Text>
        )}
        {draft.adjustments.map((a, idx) => {
          if (a.item_indexes.length === 1 && DISCOUNT_KINDS.includes(a.kind) && a.source === 'printed') return null;
          const usesPercent = a.percent !== null && DISCOUNT_KINDS.includes(a.kind);
          const amount = receipt.adjustments[idx]?.amount_minor ?? parseMajor(a.amount || '', currency) ?? 0;
          const set = (patch: Partial<typeof a>) => change((d) => ({ ...d, adjustments: d.adjustments.map((x, i) => (i === idx ? { ...x, ...patch } : x)) }));
          return (
            <View key={idx} style={[styles.adjustment, !a.enabled && styles.adjustmentOff]}>
              <View style={styles.itemTop}>
                <Switch value={a.enabled} onValueChange={(enabled) => set({ enabled })} trackColor={{ true: colors.primary600, false: colors.muted300 }} thumbColor={colors.white} />
                <View style={styles.flex}>
                  <Text style={styles.itemName}>{a.label}</Text>
                  {a.source === 'store_rule' && <Text style={styles.suggestion}>Your saved discount, not printed on the receipt</Text>}
                </View>
                <Text style={[styles.price, !a.enabled && { color: colors.muted400, textDecorationLine: 'line-through' }]}>{formatMinor(amount, currency)}</Text>
              </View>
              {usesPercent && (
                <View style={styles.presets}>
                  {PRESETS.map((p) => {
                    const active = Number((a.percent || '').replace(',', '.')) === p;
                    return (
                      <Pressable key={p} onPress={() => set({ percent: String(p), enabled: true, ...(a.source === 'printed' ? { source: 'manual' } : {}) })}
                        style={[styles.preset, active && styles.presetOn]}>
                        <Text style={[styles.presetText, active && { color: colors.white }]}>{p}%</Text>
                      </Pressable>
                    );
                  })}
                  <TextInput value={a.percent || ''} keyboardType="decimal-pad" style={styles.percent} accessibilityLabel="Discount percent"
                    onChangeText={(v) => set({ percent: v, enabled: true, ...(a.source === 'printed' ? { source: 'manual' } : {}) })} />
                  <Text style={styles.hintText}>%</Text>
                </View>
              )}
            </View>
          );
        })}

        <Text style={styles.section}>Paid by</Text>
        <View style={styles.people}>
          {members.map((m) => (
            <Pressable key={m.id} onPress={() => change((d) => ({ ...d, payers: [{ user_id: m.id, amount: '0' }] }))} style={[styles.personToggle, single !== m.id && styles.personOff]}>
              <View style={[styles.ring, single === m.id && styles.ringOn]}><Avatar uri={m.avatar} name={memberName(m)} size={34} /></View>
              <Text style={styles.personLabel} numberOfLines={1}>{nameOf(m.id).split(' ')[0]}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hintText}>Several payers? Save, then edit the expense.</Text>

        <View style={styles.summary}>
          <View style={styles.itemTop}>
            <Text style={styles.section}>Each person pays</Text>
            {syncing && <ActivityIndicator size="small" color={colors.primary700} />}
          </View>
          {totals?.people.map((p) => (
            <View key={p.user_id} style={styles.itemTop}>
              <Text style={styles.summaryName}>{nameOf(p.user_id)}</Text>
              <Text style={styles.summaryAmount}>{formatMinor(p.amount_minor, currency)}</Text>
            </View>
          ))}
          {!!totals?.unassigned_minor && (
            <View style={styles.itemTop}>
              <Text style={[styles.summaryName, { color: colors.danger600 }]}>Not assigned yet</Text>
              <Text style={[styles.summaryAmount, { color: colors.danger600 }]}>{formatMinor(totals.unassigned_minor, currency)}</Text>
            </View>
          )}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        {blocking && <Text style={styles.blocking}>{blocking}</Text>}
        <Button title={`Save expense${totals ? ` · ${formatMinor(totals.computed_total_minor, currency)}` : ''}`} onPress={save} loading={saving} disabled={!!blocking} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space(4), paddingBottom: space(10), backgroundColor: colors.background, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(8), backgroundColor: colors.white },
  lead: { fontSize: 15, color: colors.muted700, marginBottom: space(4) },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginBottom: space(4) },
  thumb: { width: 100, height: 130, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.muted100 },
  thumbImage: { width: '100%', height: '100%' },
  remove: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  pickRow: { flexDirection: 'row', gap: space(2) },
  waitTitle: { marginTop: space(4), fontSize: 17, fontWeight: '600', color: colors.muted900, textAlign: 'center' },
  waitText: { marginTop: space(1), fontSize: 14, color: colors.muted500, textAlign: 'center' },
  store: { fontSize: 20, fontWeight: '700', color: colors.muted900, marginBottom: space(3) },
  quick: { flexDirection: 'row', gap: space(2), marginBottom: space(3) },
  quickButton: { paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: radius.full, backgroundColor: colors.muted100 },
  quickText: { fontSize: 13, color: colors.muted700 },
  item: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.muted200, padding: space(3), marginBottom: space(2) },
  itemMissing: { borderColor: colors.danger500, backgroundColor: colors.danger50 },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(2) },
  itemName: { fontSize: 15, fontWeight: '600', color: colors.muted900 },
  flag: { alignSelf: 'flex-start', marginTop: 2, fontSize: 11, color: colors.warning700, backgroundColor: colors.warning50, paddingHorizontal: 6, borderRadius: 4, overflow: 'hidden' },
  suggestion: { fontSize: 12, color: colors.primary700, marginTop: 2 },
  strike: { fontSize: 12, color: colors.muted400, textDecorationLine: 'line-through' },
  price: { fontSize: 15, fontWeight: '700', color: colors.muted900 },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3), marginTop: space(2.5) },
  personToggle: { alignItems: 'center', width: 52 },
  personOff: { opacity: 0.35 },
  ring: { padding: 2, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  ringOn: { borderColor: colors.primary600 },
  personLabel: { fontSize: 11, color: colors.muted600, marginTop: 2, maxWidth: 52 },
  section: { fontSize: 15, fontWeight: '700', color: colors.muted900, marginTop: space(4), marginBottom: space(2) },
  adjustment: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.muted200, padding: space(3), marginBottom: space(2) },
  adjustmentOff: { borderStyle: 'dashed', backgroundColor: colors.muted50 },
  presets: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(2.5) },
  preset: { paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: radius.sm, borderWidth: 1, borderColor: colors.muted300 },
  presetOn: { backgroundColor: colors.primary700, borderColor: colors.primary700 },
  presetText: { fontSize: 13, color: colors.muted700, fontWeight: '600' },
  percent: { width: 56, height: 36, borderWidth: 1, borderColor: colors.muted300, borderRadius: radius.sm, textAlign: 'right', paddingHorizontal: space(2), color: colors.muted900 },
  hintText: { fontSize: 12, color: colors.muted500 },
  summary: { marginTop: space(4), padding: space(4), borderRadius: radius.lg, backgroundColor: colors.white, gap: space(2) },
  summaryName: { fontSize: 15, color: colors.muted700 },
  summaryAmount: { fontSize: 15, fontWeight: '600', color: colors.muted900 },
  footer: { padding: space(4), paddingBottom: space(6), backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.muted200, gap: space(2) },
  blocking: { fontSize: 13, color: colors.danger600, textAlign: 'center' },
});

export default ScanReceiptScreen;
