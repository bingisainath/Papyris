// src/auth/tokens.ts
// Login tokens live in the phone's secure storage (Android Keystore / iOS Keychain),
// with an in-memory copy for requests.

import * as Keychain from 'react-native-keychain';

const SERVICE = 'app.papyris.session';

let access: string | null = null;
let refresh: string | null = null;

export const tokens = {
  get access() {
    return access;
  },
  get refresh() {
    return refresh;
  },

  async load(): Promise<boolean> {
    try {
      const saved = await Keychain.getGenericPassword({ service: SERVICE });
      if (!saved) return false;
      const parsed = JSON.parse(saved.password) as { access: string; refresh: string | null };
      access = parsed.access;
      refresh = parsed.refresh;
      return !!access;
    } catch {
      return false;
    }
  },

  async save(nextAccess: string, nextRefresh?: string | null) {
    access = nextAccess;
    if (nextRefresh !== undefined) refresh = nextRefresh;
    await Keychain.setGenericPassword('papyris', JSON.stringify({ access, refresh }), {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  },

  async clear() {
    access = null;
    refresh = null;
    await Keychain.resetGenericPassword({ service: SERVICE });
  },
};
