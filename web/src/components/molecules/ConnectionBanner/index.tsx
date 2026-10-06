// src/components/molecules/ConnectionBanner/index.tsx
// Shown across the app when the live connection to the server is lost (server down or no internet).
// Waits a few seconds first so brief blips and the first connect don't flash it.

import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { WifiOff } from 'lucide-react';
import { selectIsConnected } from '../../../redux/slices/websocketSlice';
import { wsService } from '../../../services/websocket.service';

const GRACE_MS = 3000;

const ConnectionBanner: React.FC = () => {
  const connected = useSelector(selectIsConnected);
  const [show, setShow] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' || navigator.onLine);

  useEffect(() => {
    if (connected) { setShow(false); return; }
    const timer = setTimeout(() => setShow(true), GRACE_MS);
    return () => clearTimeout(timer);
  }, [connected]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  if (!show) return null;
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 px-4 py-2 bg-warning-50 border-b border-warning-200 text-sm text-warning-800">
      <WifiOff className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1 min-w-0">
        {online
          ? "Can't reach Papyris right now. Reconnecting… You can read your chats; sending works again once it's back."
          : "You're offline. Check your internet connection."}
      </span>
      {online && (
        <button type="button" onClick={() => wsService.retryNow()} className="flex-shrink-0 px-2.5 py-1 rounded-md bg-white border border-warning-300 font-medium hover:bg-warning-100">
          Try now
        </button>
      )}
    </div>
  );
};

export default ConnectionBanner;
