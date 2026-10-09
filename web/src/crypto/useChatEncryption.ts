// src/crypto/useChatEncryption.ts
// Is this chat end-to-end encrypted? It is once every member has set up encryption.

import { useEffect, useState } from 'react';
import { e2eService } from '../services/e2e.service';

/** Fired when someone's keys or a chat's members change, so open chats check again. */
export const E2E_DIRECTORY_EVENT = 'papyris:e2e-directory';

export type ChatEncryption =
  | { state: 'loading' }
  | { state: 'encrypted' }
  | { state: 'not-encrypted'; missing: string[] }; // user ids without encryption

export function useChatEncryption(conversationId: string): ChatEncryption {
  const [result, setResult] = useState<ChatEncryption & { for?: string }>({ state: 'loading' });

  useEffect(() => {
    let alive = true;
    const check = (force = false) => {
      e2eService.conversationKeys(conversationId, force)
        .then((keys) => {
          if (!alive) return;
          setResult(keys.missing.length
            ? { state: 'not-encrypted', missing: keys.missing, for: conversationId }
            : { state: 'encrypted', for: conversationId });
        })
        .catch(() => undefined);
    };
    check();
    const onChange = () => check(true);
    window.addEventListener(E2E_DIRECTORY_EVENT, onChange);
    return () => {
      alive = false;
      window.removeEventListener(E2E_DIRECTORY_EVENT, onChange);
    };
  }, [conversationId]);

  return result.for === conversationId ? result : { state: 'loading' };
}
