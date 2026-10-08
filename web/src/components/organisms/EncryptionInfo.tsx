// src/components/organisms/EncryptionInfo.tsx
// Chat info: is this chat end-to-end encrypted, and (direct chats) the security code to compare.

import React, { useEffect, useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { publicKeysOf, securityCode } from '../../crypto/e2e';
import { e2eSession } from '../../crypto/session';
import { useChatEncryption } from '../../crypto/useChatEncryption';
import { e2eService } from '../../services/e2e.service';

const EncryptionInfo: React.FC<{ conversationId: string; other?: { id: string; name: string } }> = ({ conversationId, other }) => {
  const encryption = useChatEncryption(conversationId);
  const [code, setCode] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);

  const otherId = other?.id;
  useEffect(() => {
    const keys = e2eSession.keys();
    const me = e2eSession.userId();
    if (!otherId || !keys || !me || encryption.state !== 'encrypted') return;
    e2eService.userKeys([otherId]).then((found) => {
      const theirs = found[otherId];
      if (theirs?.enc && theirs.sign) {
        setCode(securityCode({ userId: me, keys: publicKeysOf(keys) }, { userId: otherId, keys: { enc: theirs.enc, sign: theirs.sign } }));
      }
    }).catch(() => undefined);
  }, [otherId, encryption.state]);

  if (encryption.state === 'loading') return null;

  return (
    <section className="px-6 py-4 border-b border-muted-100">
      {encryption.state === 'encrypted' ? (
        <div className="flex gap-3">
          <Lock className="w-5 h-5 text-primary-700 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-900">End-to-end encrypted</p>
            <p className="text-xs text-muted-500">Messages and files here can only be read by the people in this chat.</p>
            {code && (
              showCode ? (
                <div className="mt-2">
                  <p className="font-mono text-sm tracking-wide text-muted-800 break-words">{code}</p>
                  <p className="mt-1 text-xs text-muted-500">
                    Compare this code with {other!.name} in person or on a call. If it matches on both phones or browsers, nobody
                    is listening in. It changes if either of you starts over with new keys.
                  </p>
                </div>
              ) : (
                <button type="button" onClick={() => setShowCode(true)} className="mt-1 text-xs font-medium text-primary-700 hover:underline">
                  Verify security code
                </button>
              )
            )}
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <LockOpen className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
          <div>
            <p className="text-sm font-medium text-muted-900">Not end-to-end encrypted yet</p>
            <p className="text-xs text-muted-500">
              {other ? `${other.name} hasn't set up encryption.` : `${encryption.missing.length} member${encryption.missing.length === 1 ? " hasn't" : "s haven't"} set up encryption.`}
              {' '}New messages are encrypted once everyone has.
            </p>
          </div>
        </div>
      )}
    </section>
  );
};

export default EncryptionInfo;
