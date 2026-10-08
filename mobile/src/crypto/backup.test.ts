import { fromUtf8 } from './e2e';
import { BackupError, backupKeyFrom, checkRecoveryKey, formatRecoveryKey, isRecoveryKey, newRecoveryKey, normalizeRecoveryKey, openBackup, sealBackup } from './backup';

const content = { v: 1 as const, user: 'u1', created: 1, v1Secret: 'c2VjcmV0', messages: [{ id: 'm1', conv: 'c', sender: { user: 'u1', device: 1 }, ts: 5, kind: 'text' as const, text: 'hi' }] };

test('recovery keys: 64 digits, formatted and typed back', () => {
  const k = newRecoveryKey();
  expect(k).toMatch(/^\d{64}$/);
  expect(newRecoveryKey()).not.toBe(k);
  const shown = formatRecoveryKey(k);
  expect(shown.split(' ')).toHaveLength(16);
  expect(normalizeRecoveryKey(` ${shown}\n`)).toBe(k);
  expect(isRecoveryKey('1234')).toBe(false);
});

test('a backup opens only with its recovery key, and a damaged one is refused', () => {
  const recovery = newRecoveryKey();
  const { blob, meta } = sealBackup(backupKeyFrom(recovery), content);
  expect(fromUtf8(blob)).not.toContain('hi');
  const key = checkRecoveryKey(formatRecoveryKey(recovery), meta);
  expect(openBackup(key, meta, blob)).toEqual(content);

  expect(() => checkRecoveryKey(newRecoveryKey(), meta)).toThrow(BackupError);
  // Even past the verifier, a different key can't unwrap the backup key
  expect(() => openBackup(backupKeyFrom(newRecoveryKey()), meta, blob)).toThrow(BackupError);
  const damaged = blob.slice();
  damaged[40] ^= 1;
  expect(() => openBackup(key, meta, damaged)).toThrow(/damaged/);
  // Each backup uses a new random key, so two backups never share one
  expect(sealBackup(backupKeyFrom(recovery), content).meta.wrapped_key.c).not.toBe(meta.wrapped_key.c);
});
