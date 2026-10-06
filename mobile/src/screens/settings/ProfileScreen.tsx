// src/screens/settings/ProfileScreen.tsx
// Profile edited like the web app: each field saves on its own.
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { AtSign, Camera, Info, User as UserIcon } from 'lucide-react-native';
import Avatar from '../../components/Avatar';
import EditableField from '../../components/EditableField';
import { authApi } from '../../api/auth';
import { api, errorMessage } from '../../api/client';
import { useAuth } from '../../store/auth';
import { colors, space } from '../../theme';

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
      <EditableField icon={UserIcon} label="Name" value={user.name || ''} placeholder="Add your name" max={100}
        validate={(v) => (v.trim().length < 2 ? 'Enter at least 2 characters' : null)} onSave={(name) => save({ name })} />
      <EditableField icon={Info} label="About" value={user.bio || ''} placeholder="Hey there! I'm using Papyris." max={140} onSave={(bio) => save({ bio })} />
      <EditableField icon={AtSign} label="Username" value={user.username} max={30} prefix="@"
        normalize={(v) => v.trim().toLowerCase()}
        validate={(v) => (/^[a-z0-9._]{3,30}$/.test(v) ? null : 'Use 3-30 lowercase letters, numbers, dots or underscores')}
        onSave={(username) => save({ username })} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: space(8), backgroundColor: colors.muted50 },
  camera: { position: 'absolute', right: 0, bottom: 0, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary700, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.muted50 },
});

export default ProfileScreen;
