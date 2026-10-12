// src/components/organisms/ChatWindow/ChatSearch.tsx
// Search inside one chat (header → magnifier). Encrypted messages are searched in this browser.

import React, { useEffect, useState } from 'react';
import { Lock, X } from 'lucide-react';
import { searchMessages } from '../../../services/messageSearch';
import type { SearchHit } from '../../../services/messageSearch';
import { formatMessageTime } from '../../../utils/dateFormat';

const ChatSearch: React.FC<{ conversationId: string; currentUserId?: string; onPick: (messageId: string) => void; onClose: () => void }> = ({
  conversationId, currentUserId, onPick, onClose,
}) => {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setHits(null); return; }
    let alive = true;
    const timer = window.setTimeout(() => {
      searchMessages(q, conversationId).then((r) => { if (alive) setHits(r); }).catch(() => { if (alive) setHits([]); });
    }, 250);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [query, conversationId]);

  return (
    <div className="relative border-b border-muted-100 bg-white px-4 sm:px-6 py-2">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
          placeholder="Search messages in this chat"
          aria-label="Search messages in this chat"
          className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-muted-200 focus:outline-none focus:border-primary-500"
        />
        <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-muted-100" aria-label="Close search"><X className="w-4 h-4" /></button>
      </div>
      {hits && (
        <ul className="absolute left-4 right-4 sm:left-6 sm:right-6 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-xl border border-muted-200 bg-white shadow-elevated" aria-label="Search results">
          {hits.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted-500">No messages match.</li>
          ) : hits.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => { onPick(h.id); onClose(); }} className="w-full text-left px-4 py-2.5 hover:bg-muted-50">
                <span className="flex justify-between gap-2 text-xs text-muted-500">
                  <span>{h.senderId && h.senderId === currentUserId ? 'You' : h.senderName || ''}</span>
                  <span>{formatMessageTime(h.timestamp)}</span>
                </span>
                <span className="flex items-center gap-1 text-sm text-muted-800">
                  {h.encrypted && <Lock className="w-3 h-3 flex-shrink-0 text-muted-400" aria-label="End-to-end encrypted" />}
                  <span className="truncate">{h.text}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ChatSearch;
