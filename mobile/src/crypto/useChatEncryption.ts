// src/crypto/useChatEncryption.ts
// Is this chat end-to-end encrypted? It is once every member has set up encryption.

import { useEffect, useState } from 'react';
import { e2eService } from '../services/e2e.service';
import { onEncryptionChange } from '../store/chat';
import { e2eSession } from './session';

export type ChatEncryption =
  | { state: 'loading' }
  | { state: 'encrypted' }
  | { state: 'not-encrypted'; missing: string[] }; // user ids without encryption

export function useChatEncryption(conversationId: string): ChatEncryption {
  const [result, setResult] = useState<ChatEncryption & { for?: string }>({ state: 'loading' });

  useEffect(() => {
    let alive = true;
    const check = (force = false) => {
      if (!e2eSession.keys()) return;
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
    const stop = onEncryptionChange(() => check(true));
    return () => {
      alive = false;
      stop();
    };
  }, [conversationId]);

  return result.for === conversationId ? result : { state: 'loading' };
}
