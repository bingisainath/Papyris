// src/screens/settings/BackupScreen.tsx
// Settings → Encryption & backup: what's encrypted, and the encrypted backup with its recovery key.
import React from 'react';
import { ShieldCheck } from 'lucide-react-native';
import { SettingsNote, SettingsPage } from '../../components/settings/SettingsUI';
import BackupSection from '../../components/settings/BackupSection';
import { useAuth } from '../../store/auth';

const BackupScreen: React.FC = () => {
  const userId = useAuth((s) => s.user?.id);
  return (
    <SettingsPage>
      <SettingsNote icon={ShieldCheck} title="End-to-end encryption is on"
        text="Messages, photos, videos, voice messages and files are encrypted on your devices. Expenses, receipt scans and group names and photos aren't: the server needs them to work out balances and show your chats." />
      {userId && <BackupSection userId={userId} />}
    </SettingsPage>
  );
};

export default BackupScreen;
