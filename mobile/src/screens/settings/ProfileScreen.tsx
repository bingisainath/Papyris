// src/screens/settings/ProfileScreen.tsx
// Profile edited like the web app: each field saves on its own.
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, Text } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { AtSign, Camera, Info, User as UserIcon, Wallet, CreditCard, IndianRupee } from 'lucide-react-native';
import Avatar from '../../components/Avatar';
import EditableField from '../../components/EditableField';
import { authApi } from '../../api/auth';
import { api, errorMessage } from '../../api/client';
import { useAuth } from '../../store/auth';
import { colors, space } from '../../theme';
import { showAlert } from '../../components/Dialog';

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
    showAlert('Profile photo', undefined, options);
  };

  const run = async (action: () => Promise<unknown>) => {
    setBusyPhoto(true);
    try { await action(); } catch (e) { showAlert("Couldn't update the photo", errorMessage(e)); } finally { setBusyPhoto(false); }
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

      {/* Optional: people in your chats who owe you get a Pay button for these */}
      <Text style={styles.section}>Payment details</Text>
      <Text style={styles.sectionHint}>Optional. People in your chats who owe you see a Pay button for these. Papyris never moves money.</Text>
      <EditableField icon={Wallet} label="Revolut username" value={user.payment_handles?.revolut || ''} placeholder="your-name" max={40} prefix="revolut.me/"
        normalize={(v) => v.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?revolut\.me\//i, '')}
        validate={(v) => (!v || /^[A-Za-z0-9._-]{2,40}$/.test(v) ? null : 'Letters, numbers, dots, dashes or underscores')}
        onSave={(revolut) => save({ payment_handles: { revolut } })} />
      <EditableField icon={CreditCard} label="PayPal.me username" value={user.payment_handles?.paypal || ''} placeholder="YourName" max={40} prefix="paypal.me/"
        normalize={(v) => v.trim().replace(/^https?:\/\/(www\.)?paypal\.me\//i, '')}
        validate={(v) => (!v || /^[A-Za-z0-9]{1,40}$/.test(v) ? null : 'Letters and numbers only')}
        onSave={(paypal) => save({ payment_handles: { paypal } })} />
      <EditableField icon={IndianRupee} label="UPI ID" value={user.payment_handles?.upi || ''} placeholder="name@bank" max={100}
        normalize={(v) => v.trim()}
        validate={(v) => (!v || /^[A-Za-z0-9._-]{2,64}@[A-Za-z0-9]{2,32}$/.test(v) ? null : 'Looks like name@bank')}
        onSave={(upi) => save({ payment_handles: { upi } })} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  section: { paddingHorizontal: space(4), paddingTop: space(6), fontSize: 12, fontWeight: '700', color: colors.muted500, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionHint: { paddingHorizontal: space(4), paddingTop: space(1), paddingBottom: space(2), fontSize: 12, color: colors.muted500 },
  hero: { alignItems: 'center', paddingVertical: space(8), backgroundColor: colors.muted50 },
  camera: { position: 'absolute', right: 0, bottom: 0, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary700, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.muted50 },
});

export default ProfileScreen;
