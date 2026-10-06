// src/components/EditableField.tsx
// A labelled value with a pencil: edit in place, Save or Cancel, errors shown under the field.
// Used by the profile and by group info (name, description).
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pencil } from 'lucide-react-native';
import { errorMessage } from '../api/client';
import { colors, radius, space } from '../theme';

const EditableField: React.FC<{
  icon: React.ComponentType<{ size?: number; color?: string }>; label: string; value: string; placeholder?: string; max: number; prefix?: string;
  normalize?: (v: string) => string; validate?: (v: string) => string | null; onSave: (v: string) => Promise<void>;
  multiline?: boolean; readOnly?: boolean;
}> = ({ icon: Icon, label, value, placeholder, max, prefix, normalize, validate, onSave, multiline, readOnly }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const next = normalize ? normalize(draft) : draft.trim();
    if (next === value) { setEditing(false); return; }
    const problem = validate?.(next);
    if (problem) { setError(problem); return; }
    setSaving(true);
    try { await onSave(next); setEditing(false); setError(null); } catch (e) { setError(errorMessage(e)); } finally { setSaving(false); }
  };

  return (
    <View style={styles.field}>
      <Icon size={20} color={colors.primary700} />
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {editing ? (
          <>
            <TextInput value={draft} onChangeText={(t) => { setDraft(t); setError(null); }} autoFocus maxLength={max} placeholder={placeholder}
              autoCapitalize={prefix ? 'none' : 'sentences'} multiline={multiline} style={[styles.input, multiline && styles.multiline, !!error && { borderColor: colors.danger500 }]}
              onSubmitEditing={multiline ? undefined : submit} />
            {error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.buttons}>
              <Pressable onPress={submit} disabled={saving} style={styles.saveButton}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text></Pressable>
              <Pressable onPress={() => { setEditing(false); setDraft(value); setError(null); }}><Text style={styles.cancel}>Cancel</Text></Pressable>
            </View>
          </>
        ) : (
          <Text style={[styles.value, !value && { color: colors.muted400 }]}>{value ? `${prefix || ''}${value}` : placeholder}</Text>
        )}
      </View>
      {!editing && !readOnly && (
        <Pressable onPress={() => { setDraft(value); setEditing(true); }} hitSlop={10} accessibilityLabel={`Edit ${label.toLowerCase()}`}>
          <Pencil size={18} color={colors.primary700} />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'flex-start', gap: space(4), padding: space(4), backgroundColor: colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.muted200 },
  label: { fontSize: 12, color: colors.muted500 },
  value: { fontSize: 15, color: colors.muted900, marginTop: 2 },
  input: { marginTop: space(1), height: 44, borderWidth: 1, borderColor: colors.primary500, borderRadius: radius.md, paddingHorizontal: space(3), fontSize: 15, color: colors.muted900 },
  multiline: { height: undefined, minHeight: 88, paddingTop: space(2.5), textAlignVertical: 'top' },
  error: { marginTop: space(1), fontSize: 12, color: colors.danger600 },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: space(4), marginTop: space(2) },
  saveButton: { paddingHorizontal: space(4), paddingVertical: space(2), borderRadius: radius.md, backgroundColor: colors.primary700 },
  saveText: { color: colors.white, fontWeight: '600' },
  cancel: { color: colors.muted600 },
});

export default EditableField;
