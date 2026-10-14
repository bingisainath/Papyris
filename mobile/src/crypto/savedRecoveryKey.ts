// src/crypto/savedRecoveryKey.ts
// The backup recovery key, optionally kept on this phone so signing in again can restore chats
// without typing 64 digits. It sits in the Android Keystore / iOS Keychain and opens only after
// the fingerprint, face or screen PIN. It stays when you log out (that's when it's needed), and
// goes when the app is uninstalled, the account is deleted, or backup is turned off.

import * as Keychain from 'react-native-keychain';
import { normalizeRecoveryKey } from './backup';

const service = (userId: string) => `app.shareeven.recovery.${userId}`;

const PROMPT = {
  title: 'Unlock your recovery key',
  subtitle: 'To restore your encrypted chats',
  cancel: 'Cancel',
};

/** Save it, locked behind the fingerprint / screen PIN. Throws if the phone has no screen lock. */
export async function saveRecoveryKey(userId: string, recoveryKey: string): Promise<void> {
  await Keychain.setGenericPassword('recovery-key', normalizeRecoveryKey(recoveryKey), {
    service: service(userId),
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    authenticationPrompt: { ...PROMPT, title: 'Save your recovery key on this phone', subtitle: undefined },
  });
}

/** Is one saved for this account? (Doesn't ask for the fingerprint.) */
export async function hasSavedRecoveryKey(userId: string): Promise<boolean> {
  try {
    return await Keychain.hasGenericPassword({ service: service(userId) });
  } catch {
    return false;
  }
}

/** Asks for the fingerprint / PIN. Null if cancelled or nothing is saved. */
export async function readSavedRecoveryKey(userId: string): Promise<string | null> {
  try {
    const saved = await Keychain.getGenericPassword({
      service: service(userId),
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
      authenticationPrompt: PROMPT,
    });
    return saved ? saved.password : null;
  } catch {
    return null; // cancelled, or the lock screen changed and the key was invalidated
  }
}

export async function forgetRecoveryKey(userId: string): Promise<void> {
  await Keychain.resetGenericPassword({ service: service(userId) }).catch(() => undefined);
}

/** Why saving failed, in words (most often: the phone has no screen lock). */
export function saveErrorMessage(e: unknown): string {
  const text = String((e as Error)?.message || e);
  if (/secure lock|lock screen|keyguard|not enrolled|no.*(biometr|credential)/i.test(text)) {
    return 'Set a screen lock (PIN, pattern or fingerprint) on this phone first, then try again.';
  }
  return "The key couldn't be saved on this phone. Keep your written copy safe.";
}
