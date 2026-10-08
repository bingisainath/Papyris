// src/store/auth.ts
// Who is signed in. Tokens are kept in secure storage, so the session survives restarts.

import { create } from 'zustand';
import axios from 'axios';
import { authApi, TokenPair, User } from '../api/auth';
import { errorMessage, setSessionExpiredHandler } from '../api/client';
import { tokens } from '../auth/tokens';
import { socket } from '../ws/socket';
import { disablePush, enablePush } from '../notifications/push';
import { e2eSession } from '../crypto/session';
import { stopV2 } from '../crypto/v2-platform/runtime';

type Status = 'loading' | 'signedOut' | 'signedIn';

export class NeedsVerification extends Error {
  constructor(public email: string, message: string) {
    super(message);
  }
}

interface AuthState {
  status: Status;
  user: User | null;
  restore: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  verifyEmail: (identifier: string, code: string) => Promise<void>;
  resendCode: (identifier: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User) => void;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => {
  const finishSignIn = async (pair: TokenPair) => {
    await tokens.save(pair.access_token, pair.refresh_token ?? null);
    const user = await authApi.me();
    set({ user, status: 'signedIn' });
    socket.start();
    enablePush();
  };

  setSessionExpiredHandler(() => {
    socket.stop();
    set({ user: null, status: 'signedOut' });
  });

  return {
    status: 'loading',
    user: null,

    restore: async () => {
      if (!(await tokens.load())) {
        set({ status: 'signedOut' });
        return;
      }
      try {
        const user = await authApi.me();
        set({ user, status: 'signedIn' });
        socket.start();
        enablePush();
      } catch (error) {
        // Offline: keep the session and try again later; rejected: sign out
        if (axios.isAxiosError(error) && !error.response) {
          set({ status: 'signedIn' });
          socket.start();
        } else {
          await tokens.clear();
          set({ status: 'signedOut' });
        }
      }
    },

    login: async (identifier, password) => {
      try {
        await finishSignIn(await authApi.login(identifier.trim(), password));
      } catch (error) {
        const body = axios.isAxiosError(error) ? (error.response?.data as any) : undefined;
        if (body?.code === 'email_not_verified') {
          authApi.resendCode(body.data?.email).catch(() => undefined);
          throw new NeedsVerification(body.data?.email, errorMessage(error));
        }
        throw new Error(errorMessage(error));
      }
    },

    register: async (username, email, password) => {
      try {
        await authApi.register(username.trim().toLowerCase(), email.trim().toLowerCase(), password);
      } catch (error) {
        throw new Error(errorMessage(error));
      }
    },

    verifyEmail: async (identifier, code) => {
      try {
        await finishSignIn(await authApi.verifyEmail(identifier, code));
      } catch (error) {
        throw new Error(errorMessage(error));
      }
    },

    resendCode: async (identifier) => {
      try {
        await authApi.resendCode(identifier);
      } catch (error) {
        throw new Error(errorMessage(error));
      }
    },

    refreshUser: async () => {
      set({ user: await authApi.me() });
    },

    setUser: (user) => set({ user }),

    logout: async () => {
      await disablePush(); // while still signed in, so the server accepts it
      await stopV2().catch(() => undefined); // v2: the server forgets this device; local data is wiped
      socket.stop();
      await tokens.clear();
      await e2eSession.clear(); // signing in here again means linking it again
      set({ user: null, status: 'signedOut' });
    },
  };
});
