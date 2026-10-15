// src/screens/settings/EncryptionScreen.tsx
// Settings → Linked devices: linking a new device (scan its QR code, or type the code it shows; new
// devices usually ask "Is this you?" instead), and where you're signed in. The new device is added to
// the account, and the keys and (optionally) the message history go to it encrypted for it alone.
import React, { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, CameraType } from 'react-native-camera-kit';
import { MonitorSmartphone, QrCode, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParams } from '../../navigation/types';
import { Banner, Button, TextField } from '../../components/common/ui';
import { findByCode, findByQr } from '../../crypto/v2-platform/link';
import type { FoundDevice } from '../../crypto/v2-platform/link';
import { errorMessage } from '../../api/client';
import { useKeyboardOffset } from '../../hooks/useKeyboardOffset';
import { cameraAllowed } from '../../utils/camera';
import { SettingsCard, SettingsRow } from '../../components/settings/SettingsUI';
import { useAuth } from '../../store/auth';
import { colors, radius, space } from '../../theme';
import { showAlert } from '../../components/common/Dialog';

const EncryptionScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParams>>();
  const keyboard = useKeyboardOffset();
  const userId = useAuth((s) => s.user?.id);
  const [code, setCode] = useState('');
  const [found, setFound] = useState<FoundDevice | null>(null);
  const [sendHistory, setSendHistory] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const handled = useRef(false);

  const lookup = async (find: () => Promise<FoundDevice>) => {
    setBusy(true);
    setError('');
    try {
      setFound(await find());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const scan = async () => {
    if (!(await cameraAllowed())) return;
    handled.current = false;
    setError('');
    setScanning(true);
  };

  const onRead = (text: string) => {
    if (handled.current) return; // the camera reports the same code many times a second
    handled.current = true;
    setScanning(false);
    lookup(() => findByQr(userId!, text));
  };

  const link = async () => {
    if (!found) return;
    setBusy(true);
    setError('');
    try {
      await found.approve(sendHistory);
      showAlert('Device linked', `${found.name} can now read your encrypted chats.`);
      setFound(null);
      setCode('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View ref={keyboard.ref} style={[styles.flex, { paddingBottom: keyboard.offset }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>Link a device</Text>
        {!!error && <Banner text={error} />}
        {found ? (
          <View style={styles.confirm}>
            <Text style={styles.title}>Link {found.name}?</Text>
            <Text style={styles.text}>
              It will be able to read all your end-to-end encrypted chats. Only continue if it's your own device and you just signed in on it.
            </Text>
            <View style={styles.history}>
              <View style={styles.flexText}>
                <Text style={styles.historyTitle}>Send my message history</Text>
                <Text style={styles.text}>Encrypted so only that device can open it.</Text>
              </View>
              <Switch value={sendHistory} onValueChange={setSendHistory} trackColor={{ true: colors.primary600, false: colors.muted300 }} thumbColor={colors.white}
                accessibilityLabel="Send my message history" />
            </View>
            <View style={styles.buttons}>
              <Button title="Cancel" variant="secondary" compact onPress={() => setFound(null)} />
              <Button title={busy ? 'Linking…' : 'Link device'} compact loading={busy} onPress={link} />
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.text}>Sign in on the new phone or browser. It shows a QR code: scan it here, or type the code under it.</Text>
            <Button title="Scan QR code" icon={QrCode} onPress={scan} style={{ marginTop: space(3) }} />
            <Text style={[styles.text, styles.or]}>or</Text>
            <TextField label="Code" value={code} onChangeText={setCode} placeholder="ABCD-EFGH-IJKL-MNOP" autoCapitalize="characters"
              autoCorrect={false} style={styles.codeInput} />
            <Button title={busy ? 'Finding…' : 'Continue'} variant="secondary" loading={busy}
              disabled={code.replace(/[^a-z0-9]/gi, '').length < 16} onPress={() => lookup(() => findByCode(userId!, code))} />
          </>
        )}

        <Text style={[styles.section, styles.sectionGap]}>Where you're signed in</Text>
        <SettingsCard>
          <SettingsRow first icon={MonitorSmartphone} label="Sessions" hint="Every phone and browser signed in to your account; sign one out"
            onPress={() => navigation.navigate('Sessions')} />
        </SettingsCard>
      </ScrollView>

      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        <SafeAreaView style={styles.scanner}>
          <View style={styles.scannerTop}>
            <Text style={styles.scannerTitle}>Scan the QR code on the new device</Text>
            <Pressable onPress={() => setScanning(false)} hitSlop={10} accessibilityLabel="Close"><X size={24} color={colors.white} /></Pressable>
          </View>
          {scanning && (
            <Camera
              style={styles.flex}
              cameraType={CameraType.Back}
              scanBarcode
              showFrame
              laserColor={colors.primary500}
              frameColor={colors.white}
              onReadCode={(e) => onRead(e.nativeEvent.codeStringValue)}
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: space(4), paddingBottom: space(10) },
  card: { flexDirection: 'row', gap: space(3), padding: space(4), borderRadius: radius.lg, backgroundColor: colors.white },
  confirm: { padding: space(4), borderRadius: radius.lg, backgroundColor: colors.white },
  title: { fontSize: 16, fontWeight: '600', color: colors.muted900 },
  text: { fontSize: 13, color: colors.muted600, marginTop: space(1) },
  or: { textAlign: 'center', marginVertical: space(3) },
  codeInput: { fontFamily: 'monospace', letterSpacing: 1 },
  section: { marginTop: space(2), marginBottom: space(2), fontSize: 12, fontWeight: '700', color: colors.muted500, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionGap: { marginTop: space(8) },
  history: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(3) },
  flexText: { flex: 1 },
  historyTitle: { fontSize: 14, fontWeight: '600', color: colors.muted900 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: space(2), marginTop: space(3) },
  scanner: { flex: 1, backgroundColor: '#000' },
  scannerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space(4) },
  scannerTitle: { color: colors.white, fontSize: 16, fontWeight: '600' },
});

export default EncryptionScreen;
