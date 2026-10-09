// src/components/BackupSection.tsx
// Settings → End-to-end encryption → Encrypted backup: turn it on (shows a 64-digit recovery key
// once), back up now, use the key on this phone too, or turn it off.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Copy, Share2 } from 'lucide-react-native';
import { Button, TextField } from './ui';
import { formatRecoveryKey, isRecoveryKey, newRecoveryKey } from '../crypto/backup';
import { adoptRecoveryKey, backupStatus, runBackup, turnOffBackup, turnOnBackup } from '../crypto/backupRuntime';
import type { BackupStatus } from '../crypto/backupRuntime';
import { errorMessage } from '../api/client';
import { formatSize } from '../utils/time';
import { colors, radius, space } from '../theme';
import { showAlert } from './Dialog';

const BackupSection: React.FC<{ userId: string }> = ({ userId }) => {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [typed, setTyped] = useState('');
  const [entering, setEntering] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    backupStatus(userId).then(setStatus).catch(() => setStatus(null));
  }, [userId]);
  useEffect(load, [load]);

  const act = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await fn();
      showAlert(done);
      setNewKey(null);
      setSaved(false);
      setEntering(false);
      setTyped('');
      load();
    } catch (e) {
      showAlert("Couldn't do that", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Encrypted backup</Text>
      <Text style={styles.text}>
        If you lose every device, a backup lets you read your encrypted chats again. It's encrypted with a 64-digit recovery key that only
        you have: Papyris can't open it, and can't help if the key is lost.
      </Text>

      {status === null ? null : !status.exists && !newKey ? (
        <Button title="Turn on backup" variant="secondary" compact onPress={() => setNewKey(newRecoveryKey())} style={styles.top} />
      ) : newKey ? (
        <View style={styles.top}>
          <Text style={styles.text}>Your recovery key. Write it down or save it somewhere safe: it won't be shown again.</Text>
          <Text style={styles.key} selectable>{formatRecoveryKey(newKey)}</Text>
          <View style={styles.row}>
            <Pressable onPress={() => { Clipboard.setString(formatRecoveryKey(newKey)); showAlert('Copied'); }} style={styles.chip}>
              <Copy size={16} color={colors.muted700} /><Text style={styles.chipText}>Copy</Text>
            </Pressable>
            <Pressable onPress={() => Share.share({ message: `Papyris recovery key:\n${formatRecoveryKey(newKey)}` })} style={styles.chip}>
              <Share2 size={16} color={colors.muted700} /><Text style={styles.chipText}>Save elsewhere</Text>
            </Pressable>
          </View>
          <Pressable style={styles.check} onPress={() => setSaved((s) => !s)}>
            <Switch value={saved} onValueChange={setSaved} trackColor={{ true: colors.primary600, false: colors.muted300 }} thumbColor={colors.white} />
            <Text style={styles.checkText}>I've saved my recovery key</Text>
          </Pressable>
          <View style={styles.row}>
            <Button title="Cancel" variant="secondary" compact onPress={() => setNewKey(null)} />
            <Button title={busy ? 'Backing up…' : 'Turn on and back up'} compact loading={busy} disabled={!saved}
              onPress={() => act(() => turnOnBackup(userId, newKey), 'Backup turned on')} />
          </View>
        </View>
      ) : (
        <View style={styles.top}>
          <Text style={styles.text}>
            On. Last backup {status.created_at ? new Date(status.created_at).toLocaleString() : '—'}{status.size ? ` · ${formatSize(status.size)}` : ''}.
            {status.thisDevice ? ' This phone backs up once a day.' : ''}
          </Text>
          {!status.thisDevice && !entering && (
            <Pressable onPress={() => setEntering(true)} style={styles.top}>
              <Text style={styles.link}>Back up from this phone too (needs your recovery key)</Text>
            </Pressable>
          )}
          {entering && (
            <View style={styles.top}>
              <TextField label="64-digit recovery key" value={typed} onChangeText={setTyped} keyboardType="number-pad" />
              <Button title="Use key" compact disabled={!isRecoveryKey(typed) || busy}
                onPress={() => act(() => adoptRecoveryKey(userId, typed), 'This phone will back up too')} />
            </View>
          )}
          <View style={[styles.row, styles.top]}>
            {status.thisDevice && <Button title={busy ? 'Backing up…' : 'Back up now'} variant="secondary" compact loading={busy} onPress={() => act(() => runBackup(userId), 'Backed up')} />}
            <Button title="Turn off" variant="danger" compact onPress={() => showAlert('Turn off backups?', 'The backup is deleted. Without it, losing every device means losing your encrypted chats.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Turn off', style: 'destructive', onPress: () => act(() => turnOffBackup(userId), 'Backup turned off') },
            ])} />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { marginTop: space(6), padding: space(4), borderRadius: radius.lg, backgroundColor: colors.white },
  title: { fontSize: 16, fontWeight: '600', color: colors.muted900 },
  text: { fontSize: 13, color: colors.muted600, marginTop: space(1) },
  top: { marginTop: space(3) },
  key: { marginTop: space(3), fontFamily: 'monospace', fontSize: 16, letterSpacing: 1, lineHeight: 26, color: colors.muted900 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(3) },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space(3), paddingVertical: space(2), borderRadius: radius.md, backgroundColor: colors.muted100 },
  chipText: { fontSize: 13, color: colors.muted700 },
  check: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(3) },
  checkText: { flex: 1, fontSize: 13, color: colors.muted700 },
  link: { color: colors.primary700, fontWeight: '600' },
});

export default BackupSection;
