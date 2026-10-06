// src/screens/settings/ProfileScreen.tsx
// Profile edited like the web app: each field saves on its own.
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { AtSign, Camera, Info, Pencil, User as UserIcon } from 'lucide-react-native';
import Avatar from '../../components/Avatar';
import { authApi } from '../../api/auth';
import { api, errorMessage } from '../../api/client';
import { useAuth } from '../../store/auth';
import { colors, radius, space } from '../../theme';

const ProfileScreen: React.FC = () => {
  const { user, setUser } = useAuth();
  const [busyPhoto, setBusyPhoto] = useState(false);
  if (!user) return null;

  const save = async (patch: Parameters<typeof authApi.updateMe>[0]) => setUser(await authApi.updateMe(patch));

  const changePhoto = () => {
    const options = [
      { text: 'Choose photo', onPress: pickPhoto },
      ...(user.avatar ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: () => run(() => save({ avatar: '' })) }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ];
    Alert.alert('Profile photo', undefined, options);
  };

  const run = async (action: () => Promise<unknown>) => {
    setBusyPhoto(true);
    try { await action(); } catch (e) { Alert.alert("Couldn't update the photo", errorMessage(e)); } finally { setBusyPhoto(false); }
  };

  const pickPhoto = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, maxWidth: 1024, maxHeight: 1024, quality: 0.8 });
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    run(async () => {
      const form = new FormData();
      form.append('file', { uri: asset.uri, type: asset.type || 'image/jpeg', name: asset.fileName || 'avatar.jpg' } as any);
      const r = await api.post('/media/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      await save({ avatar: r.data.data.url });
    });
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: space(10) }} style={{ backgroundColor: colors.background }}>
      <View style={styles.hero}>
        <Pressable onPress={changePhoto} accessibilityLabel="Change profile photo">
          <Avatar uri={user.avatar} name={user.name || user.username} size={112} />
          <View style={styles.camera}>{busyPhoto ? <ActivityIndicator size="small" color={colors.white} /> : <Camera size={18} color={colors.white} />}</View>
        </Pressable>
      </View>
      <Field icon={UserIcon} label="Name" value={user.name || ''} placeholder="Add your name" max={100}
        validate={(v) => (v.trim().length < 2 ? 'Enter at least 2 characters' : null)} onSave={(name) => save({ name })} />
      <Field icon={Info} label="About" value={user.bio || ''} placeholder="Hey there! I'm using Papyris." max={140} onSave={(bio) => save({ bio })} />
      <Field icon={AtSign} label="Username" value={user.username} max={30} prefix="@"
        normalize={(v) => v.trim().toLowerCase()}
        validate={(v) => (/^[a-z0-9._]{3,30}$/.test(v) ? null : 'Use 3-30 lowercase letters, numbers, dots or underscores')}
        onSave={(username) => save({ username })} />
    </ScrollView>
  );
};

const Field: React.FC<{
  icon: React.ComponentType<{ size?: number; color?: string }>; label: string; value: string; placeholder?: string; max: number; prefix?: string;
  normalize?: (v: string) => string; validate?: (v: string) => string | null; onSave: (v: string) => Promise<void>;
}> = ({ icon: Icon, label, value, placeholder, max, prefix, normalize, validate, onSave }) => {
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
              autoCapitalize={prefix ? 'none' : 'sentences'} style={[styles.input, !!error && { borderColor: colors.danger500 }]} onSubmitEditing={submit} />
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
      {!editing && (
        <Pressable onPress={() => { setDraft(value); setEditing(true); }} hitSlop={10} accessibilityLabel={`Edit ${label.toLowerCase()}`}>
          <Pencil size={18} color={colors.primary700} />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: space(8), backgroundColor: colors.muted50 },
  camera: { position: 'absolute', right: 0, bottom: 0, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary700, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.muted50 },
  field: { flexDirection: 'row', alignItems: 'flex-start', gap: space(4), padding: space(4), backgroundColor: colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.muted200 },
  label: { fontSize: 12, color: colors.muted500 },
  value: { fontSize: 15, color: colors.muted900, marginTop: 2 },
  input: { marginTop: space(1), height: 44, borderWidth: 1, borderColor: colors.primary500, borderRadius: radius.md, paddingHorizontal: space(3), fontSize: 15, color: colors.muted900 },
  error: { marginTop: space(1), fontSize: 12, color: colors.danger600 },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: space(4), marginTop: space(2) },
  saveButton: { paddingHorizontal: space(4), paddingVertical: space(2), borderRadius: radius.md, backgroundColor: colors.primary700 },
  saveText: { color: colors.white, fontWeight: '600' },
  cancel: { color: colors.muted600 },
});

export default ProfileScreen;
