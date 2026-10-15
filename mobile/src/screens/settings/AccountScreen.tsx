// src/screens/settings/AccountScreen.tsx
// Settings → Account: profile and payment details, email, your data, deleting the account.
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AtSign, Download, Mail, Trash2, UserRound } from 'lucide-react-native';
import { SettingsCard, SettingsLabel, SettingsPage, SettingsRow } from '../../components/settings/SettingsUI';
import { saveMyData } from '../../api/auth';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../store/auth';
import type { AppStackParams } from '../../navigation/types';
import { showAlert } from '../../components/common/Dialog';

const PAY_NAMES: Record<string, string> = { revolut: 'Revolut', paypal: 'PayPal', upi: 'UPI' };

const AccountScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParams>>();
  const user = useAuth((s) => s.user);
  if (!user) return null;
  const payTo = Object.keys(PAY_NAMES).filter((k) => (user.payment_handles as Record<string, string> | undefined)?.[k]);

  return (
    <SettingsPage>
      <SettingsCard>
        <SettingsRow first icon={UserRound} label="Profile" hint="Name, photo, bio and payment details"
          badge={payTo.length ? { text: payTo.map((k) => PAY_NAMES[k]).join(', '), tone: 'tint' } : undefined}
          onPress={() => navigation.navigate('Profile')} />
        <SettingsRow icon={AtSign} label="Username" hint={`@${user.username}`} />
        <SettingsRow icon={Mail} label="Email" hint={user.email} />
      </SettingsCard>

      <SettingsLabel text="Your data" />
      <SettingsCard>
        <SettingsRow first icon={Download} label="Download my data" hint="Profile, chats, expenses and receipts as a file"
          onPress={() => saveMyData().then((name) => showAlert('Saved to Downloads', name)).catch((e) => showAlert("Couldn't download", errorMessage(e)))} />
        <SettingsRow icon={Trash2} label="Delete account" hint="Signs you out everywhere; can't be undone" danger
          onPress={() => navigation.navigate('DeleteAccount')} />
      </SettingsCard>
    </SettingsPage>
  );
};

export default AccountScreen;
