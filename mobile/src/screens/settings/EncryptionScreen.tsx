// src/screens/settings/EncryptionScreen.tsx
// Settings → End-to-end encryption: what's encrypted, and linking a new device (scan its QR code,
// or type the code it shows). The keys go to that device encrypted for it alone.
import React, { useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, CameraType } from 'react-native-camera-kit';
import { QrCode, ShieldCheck, X } from 'lucide-react-native';
import { Banner, Button, TextField } from '../../components/ui';
import { approve, findByCode, findByQr } from '../../crypto/linking';
import type { FoundLink } from '../../crypto/linking';
import { errorMessage } from '../../api/client';
import { useKeyboardOffset } from '../../hooks/useKeyboardOffset';
import { cameraAllowed } from '../../utils/camera';
import { colors, radius, space } from '../../theme';

const EncryptionScreen: React.FC = () => {
  const keyboard = useKeyboardOffset();
  const [code, setCode] = useState('');
  const [found, setFound] = useState<FoundLink | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const handled = useRef(false);

  const lookup = async (find: () => Promise<FoundLink>) => {
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
    lookup(() => findByQr(text));
  };

  const link = async () => {
    if (!found) return;
    setBusy(true);
    setError('');
    try {
      await approve(found);
      Alert.alert('Device linked', `${found.request.device_name} can now read your encrypted chats.`);
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
        <View style={styles.card}>
          <ShieldCheck size={24} color={colors.primary700} />
          <View style={styles.flex}>
            <Text style={styles.title}>End-to-end encryption is on</Text>
            <Text style={styles.text}>
              Messages, photos, videos, voice messages and files in chats where everyone has set it up are encrypted on your devices.
              Expenses, receipt scans and group names and photos aren't: the server needs them to work out balances and show your chats.
            </Text>
          </View>
        </View>

        <Text style={styles.section}>Link a device</Text>
        {!!error && <Banner text={error} />}
        {found ? (
          <View style={styles.confirm}>
            <Text style={styles.title}>Link {found.request.device_name}?</Text>
            <Text style={styles.text}>
              It will be able to read all your end-to-end encrypted chats. Only continue if it's your own device and you just signed in on it.
            </Text>
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
              disabled={code.replace(/[^a-z0-9]/gi, '').length < 16} onPress={() => lookup(() => findByCode(code))} />
          </>
        )}
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
  section: { marginTop: space(6), marginBottom: space(2), fontSize: 12, fontWeight: '700', color: colors.muted500, textTransform: 'uppercase', letterSpacing: 0.5 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: space(2), marginTop: space(3) },
  scanner: { flex: 1, backgroundColor: '#000' },
  scannerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space(4) },
  scannerTitle: { color: colors.white, fontSize: 16, fontWeight: '600' },
});

export default EncryptionScreen;
