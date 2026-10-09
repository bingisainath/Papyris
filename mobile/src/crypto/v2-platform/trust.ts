// src/crypto/v2-platform/trust.ts
// Security codes and key-change notices on the phone (crypto/v2/trust.ts, phase 6); same as web.

import { useCallback, useEffect, useState } from 'react';
import { acceptKeyChange, acknowledgeKeyChange, setVerified, trustOf, verificationQr } from '../v2';
import type { Trust } from '../v2';
import { v2Runtime } from './runtime';
import { checkVerificationQr } from '../v2';
import { onEncryptionChange } from '../../store/chat';

// After a verification or acknowledgement the chat banner and info screen update together
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

async function runtime() {
  const rt = await v2Runtime()?.catch(() => null);
  return rt?.state.listed ? rt : null;
}

/** Trust in each of these people (fetching their current keys first). Null when v2 isn't running here. */
async function trustIn(users: string[]): Promise<Trust[] | null> {
  const rt = await runtime();
  if (!rt) return null;
  await rt.messenger.devicesOf(rt.userId).catch(() => null); // our own account key, for the code
  const others = users.filter((u) => u !== rt.userId);
  await Promise.all(others.map((u) => rt.messenger.devicesOf(u).catch(() => null)));
  return Promise.all(others.map((u) => trustOf(rt.store, rt.userId, u)));
}

function useTrustList(users: string[]): Trust[] | null {
  const [result, setResult] = useState<Trust[] | null>(null);
  const key = users.join(',');
  useEffect(() => {
    let alive = true;
    const load = () => { trustIn(key ? key.split(',') : []).then((r) => { if (alive) setResult(r); }).catch(() => undefined); };
    load();
    listeners.add(load);
    const stop = onEncryptionChange(load);
    return () => {
      alive = false;
      listeners.delete(load);
      stop();
    };
  }, [key]);
  return result;
}

/** Direct chats: the security code with this person, whether they're verified, and the QR text to show. */
export function useTrust(otherId?: string): { trust: Trust | null; qr: string | null } {
  const list = useTrustList(otherId ? [otherId] : []);
  const [qr, setQr] = useState<string | null>(null);
  const trust = list?.[0] || null;
  useEffect(() => {
    if (!otherId || !trust?.code) return;
    runtime().then((rt) => (rt ? verificationQr(rt.store, rt.userId, otherId) : null)).then(setQr).catch(() => undefined);
  }, [otherId, trust?.code]);
  return { trust, qr };
}

/** Members whose security code changed and who haven't been looked at yet (for the chat banner). */
export function useKeyChanges(members: string[]): Trust[] {
  const list = useTrustList(members);
  return (list || []).filter((t) => t.needsAccept || t.changedAt);
}

export const useTrustActions = () => ({
  verify: useCallback(async (user: string, verified: boolean) => {
    const rt = await runtime();
    if (rt) await setVerified(rt.store, user, verified);
    changed();
  }, []),
  accept: useCallback(async (user: string) => {
    const rt = await runtime();
    if (rt) await acceptKeyChange(rt.store, user);
    changed();
  }, []),
  dismiss: useCallback(async (user: string) => {
    const rt = await runtime();
    if (rt) await acknowledgeKeyChange(rt.store, user);
    changed();
  }, []),
});

/** Scanned the QR code on the other person's screen: 'match' marks them verified. */
export async function scanVerification(otherId: string, text: string): Promise<'match' | 'mismatch' | 'other'> {
  const rt = await runtime();
  if (!rt) return 'other';
  const result = await checkVerificationQr(rt.store, rt.userId, otherId, text);
  changed();
  return result;
}
