// src/screens/expenses/CurrencyPicker.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, X } from 'lucide-react-native';
import { expenseService } from '../../api/expenses';
import type { CurrencyInfo } from '../../utils/money';
import { colors, radius, space } from '../../theme';

let cache: CurrencyInfo[] | null = null;

const CurrencyPicker: React.FC<{ visible: boolean; value: string; onPick: (code: string) => void; onClose: () => void }> = ({ visible, value, onPick, onClose }) => {
  const [list, setList] = useState<CurrencyInfo[]>(cache || []);
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!visible || cache) return;
    expenseService.currencies().then((c) => { cache = c; setList(c); }).catch(() => undefined);
  }, [visible]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((c) => !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [list, query]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>Currency</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close"><X size={22} color={colors.muted600} /></Pressable>
        </View>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search" placeholderTextColor={colors.muted400} style={styles.search} autoCapitalize="none" />
        <FlatList
          data={shown}
          keyExtractor={(c) => c.code}
          renderItem={({ item }) => (
            <Pressable onPress={() => onPick(item.code)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.muted50 }]}>
              <Text style={styles.code}>{item.code}</Text>
              <Text style={styles.name}>{item.name}</Text>
              {item.code === value && <Check size={18} color={colors.primary700} />}
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space(4) },
  title: { fontSize: 18, fontWeight: '700', color: colors.muted900 },
  search: { marginHorizontal: space(4), marginBottom: space(2), height: 44, paddingHorizontal: space(3), borderRadius: radius.md, backgroundColor: colors.muted100, fontSize: 15, color: colors.muted900 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(3) },
  code: { width: 48, fontSize: 15, fontWeight: '700', color: colors.muted900 },
  name: { flex: 1, fontSize: 15, color: colors.muted600 },
});

export default CurrencyPicker;
