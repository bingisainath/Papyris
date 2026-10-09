// src/screens/auth/E2EGate.tsx
// After sign-in, before the chats: make sure this phone has the account's encryption keys
// (same flow as web/src/app/E2EGate.tsx).
// - First device on the account: keys are created here silently, nothing to do.
// - Another device already has them: show a QR code (and a code to type); that device adds this
//   phone to the account and sends the keys and message history over (encrypted for this phone
//   alone) from Settings → End-to-end encryption → Link a device.
// - No other device available: start fresh with new keys; older encrypted messages can't be read.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import AuthLayout from './AuthLayout';
import { Banner, Button, TextField } from '../../components/ui';
import { publicKeysOf } from '../../crypto/e2e';
import { e2eSession } from '../../crypto/session';
import { linkHere, listStatus, startFreshV2 } from '../../crypto/v2-platform/link';
import type { LinkHere } from '../../crypto/v2-platform/link';
import { e2eService } from '../../services/e2e.service';
import type { MyKeys } from '../../services/e2e.service';
import { errorMessage } from '../../api/client';
import { startV2 } from '../../crypto/v2-platform/runtime';
import { backupIfDue, restoreFromBackup } from '../../crypto/backupRuntime';
import { syncV2 } from '../../store/chat';
import { isRecoveryKey } from '../../crypto/backup';
import { api } from '../../api/client';
import { useAuth } from '../../store/auth';
import { phoneName } from '../../utils/device';
import { colors, radius, space } from '../../theme';

type Stage = { name: 'checking' } | { name: 'ready' } | { name: 'link'; mine: MyKeys } | { name: 'error'; message: string };


const E2EGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const [stage, setStage] = useState<Stage>({ name: 'checking' });
  const userId = user?.id;

  const check = useCallback(async () => {
    if (!userId) return;
    setStage({ name: 'checking' });
    try {
      const mine = await e2eService.mine();
      if (!mine.has_keys) {
        // First device on this account: create the keys here, nothing to ask
        await e2eSession.clear();
        await e2eSession.set(userId, await e2eService.setUp());
        setStage({ name: 'ready' });
        return;
      }
      // Keys from earlier on this phone, still the account's current keys, and this phone on the device list?
      if (await e2eSession.restore(userId)) {
        if (publicKeysOf(e2eSession.keys()!).enc === mine.enc_public) {
          const status = await listStatus(userId);
          if (status === 'orphaned') {
            // Every device that held the account key has logged out, but this phone has the keys:
            // it becomes the account's first device (contacts see a new security code; nothing is lost)
            await startFreshV2(userId);
          }
          if (status !== 'not_listed') {
            setStage({ name: 'ready' });
            return;
          }
        } else {
          await e2eSession.clear(); // a fresh start on another device since
        }
      }
      setStage({ name: 'link', mine });
    } catch (e) {
      setStage({ name: 'error', message: errorMessage(e) });
    }
  }, [userId]);

  useEffect(() => { check(); }, [check]);

  // Encryption v2 starts in the background once this phone is ready (registers, uploads prekeys)
  useEffect(() => {
    if (stage.name === 'ready' && userId) {
      startV2(userId)
        .then(() => syncV2()) // v2 packets that arrived while signed out
        .then(() => backupIfDue(userId))
        .catch((e) => console.warn('Encryption v2 setup or backup failed (will retry next start):', e?.message || e));
    }
  }, [stage.name, userId]);

  // Our keys were replaced on another device: link again
  useEffect(() => e2eSession.onStale(() => { e2eSession.clear().then(check); }), [check]);

  if (stage.name === 'ready') return <>{children}</>;

  if (stage.name === 'checking') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary700} />
      </View>
    );
  }

  const footer = (
    <Text style={styles.footer}>
      Signed in as <Text style={styles.bold}>{user?.username}</Text> ·{' '}
      <Text style={styles.link} onPress={() => logout()}>Log out</Text>
    </Text>
  );

  if (stage.name === 'error') {
    return (
      <AuthLayout title="Couldn't check your encryption" subtitle={stage.message}>
        <Button title="Try again" onPress={check} />
        {footer}
      </AuthLayout>
    );
  }

  return <LinkThisPhone mine={stage.mine} userId={userId!} footer={footer} onDone={() => setStage({ name: 'ready' })} />;
};

const LinkThisPhone: React.FC<{ mine: MyKeys; userId: string; footer: React.ReactNode; onDone: () => void }> = ({ mine, userId, footer, onDone }) => {
  const [link, setLink] = useState<LinkHere | null>(null);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [noDevice, setNoDevice] = useState(false);
  const [hasBackup, setHasBackup] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const attempt = useRef(0);

  useEffect(() => {
    api.get('/e2e/backup').then((r) => setHasBackup(!!r.data.data.exists)).catch(() => undefined);
  }, []);

  const restore = async () => {
    setBusy(true);
    attempt.current += 1; // stop waiting for another device
    try {
      await restoreFromBackup(userId, recoveryKey, mine.enc_public!);
      onDone();
    } catch (e: any) {
      begin(); // keep waiting for another device too (this clears the error, so set it after)
      setError(e?.message || errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const begin = useCallback(async () => {
    const mineAttempt = ++attempt.current;
    setExpired(false);
    setError('');
    setLink(null);
    try {
      const pending = await linkHere(userId, mine.enc_public!, phoneName());
      if (mineAttempt !== attempt.current) return;
      setLink(pending);
      const result = await pending.wait(() => mineAttempt !== attempt.current);
      if (mineAttempt !== attempt.current) return;
      if (result === 'expired') {
        setExpired(true);
        return;
      }
      onDone();
    } catch (e) {
      if (mineAttempt === attempt.current) setError(errorMessage(e));
    }
  }, [mine.enc_public, userId, onDone]);

  useEffect(() => {
    begin();
    return () => { attempt.current += 1; }; // stop waiting when leaving
  }, [begin]);

  const startFresh = () => Alert.alert(
    'Start fresh with new keys?',
    "Your encrypted messages from before can't be read again, on any device, and the people you chat with will see that your keys changed.",
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start fresh', style: 'destructive', onPress: async () => {
          setBusy(true);
          attempt.current += 1;
          try {
            await e2eSession.set(userId, await e2eService.setUp(true));
            await startFreshV2(userId);
            onDone();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ],
  );

  return (
    <AuthLayout
      title="Link this phone"
      subtitle="Your chats are end-to-end encrypted. To read them here, open Papyris on another signed-in device, go to Settings → End-to-end encryption → Link a device, and scan this code or type the code below."
    >
      {!!error && <Banner text={error} />}
      <View style={styles.qrBox}>
        {link && !expired ? (
          <>
            <View style={styles.qr}><QRCode value={link.qrText} size={200} /></View>
            <Text style={styles.small}>Or type this code on the other device</Text>
            <Text style={styles.code} selectable>{link.code}</Text>
            <View style={styles.waiting}>
              <ActivityIndicator size="small" color={colors.primary700} />
              <Text style={styles.small}>Waiting for your other device…</Text>
            </View>
          </>
        ) : expired ? (
          <>
            <Text style={styles.small}>The code expired.</Text>
            <Button title="Show a new code" onPress={begin} compact style={{ marginTop: space(3) }} />
          </>
        ) : error ? (
          <Button title="Try again" onPress={begin} compact />
        ) : (
          <ActivityIndicator color={colors.primary700} />
        )}
      </View>
      {noDevice ? (
        <View style={styles.noDevice}>
          {hasBackup && (
            <>
              <Text style={styles.noDeviceTitle}>Restore from your backup</Text>
              <TextField label="64-digit recovery key" value={recoveryKey} onChangeText={setRecoveryKey} keyboardType="number-pad" autoCorrect={false} />
              <Button title={busy ? 'Restoring…' : 'Restore'} onPress={restore} loading={busy} disabled={!isRecoveryKey(recoveryKey)} />
            </>
          )}
          <Pressable onPress={startFresh} disabled={busy} style={styles.fresh}>
            <Text style={[styles.link, { color: colors.danger600 }]}>Start fresh with new keys</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setNoDevice(true)} disabled={busy} style={styles.fresh}>
          <Text style={styles.link}>Don't have your other device?</Text>
        </Pressable>
      )}
      {footer}
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  footer: { marginTop: space(5), textAlign: 'center', fontSize: 13, color: colors.muted500 },
  bold: { fontWeight: '600', color: colors.muted700 },
  link: { color: colors.primary700, fontWeight: '600' },
  qrBox: { alignItems: 'center', paddingVertical: space(2) },
  qr: { padding: space(3), backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.muted200 },
  small: { marginTop: space(3), fontSize: 12, color: colors.muted500, textAlign: 'center' },
  code: { marginTop: space(1), fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 18, letterSpacing: 1.5, color: colors.muted900 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  fresh: { alignItems: 'center', marginTop: space(5) },
  noDevice: { marginTop: space(5), padding: space(4), borderRadius: radius.lg, borderWidth: 1, borderColor: colors.muted200, backgroundColor: colors.white },
  noDeviceTitle: { fontSize: 15, fontWeight: '600', color: colors.muted900, marginBottom: space(2) },
});

export default E2EGate;
