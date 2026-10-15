// src/screens/settings/HelpScreen.tsx
// Settings → Help & about: the info pages (open on shareeven.com).
import React from 'react';
import { FileText, HelpCircle, Info, LifeBuoy, LockKeyhole } from 'lucide-react-native';
import { SettingsCard, SettingsPage, SettingsRow } from '../../components/settings/SettingsUI';
import { openInfoPage } from '../../components/common/InfoLinks';

const HelpScreen: React.FC = () => (
  <SettingsPage>
    <SettingsCard>
      <SettingsRow first icon={HelpCircle} label="FAQ" hint="Common questions about chats, expenses and encryption" onPress={() => openInfoPage('faq')} />
      <SettingsRow icon={LifeBuoy} label="Contact us" hint="Support, privacy and security" onPress={() => openInfoPage('contact')} />
      <SettingsRow icon={Info} label="About ShareEven" onPress={() => openInfoPage('about')} />
      <SettingsRow icon={FileText} label="Terms of Service" onPress={() => openInfoPage('terms')} />
      <SettingsRow icon={LockKeyhole} label="Privacy Policy" onPress={() => openInfoPage('privacy')} />
    </SettingsCard>
  </SettingsPage>
);

export default HelpScreen;
