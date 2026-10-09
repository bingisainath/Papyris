// src/components/organisms/SessionsSettings.tsx
// Settings → Sessions: the phones and browsers signed in to this account right now, when each signed
// in and was last active, and whether it's linked for end-to-end encryption.

import React, { useEffect, useState } from 'react';
import { Globe, MonitorSmartphone, QrCode, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react';
import { LINK_DEVICE_EVENT } from './EncryptionSettings';
import api from '../../utils/axios';
import { v2Runtime } from '../../crypto/v2-platform/runtime';
import { parseApiError } from '../../utils/apiError';

interface Session { device_id: number; name: string; created_at: string | null; last_seen_at: string | null; linked: boolean }

const BROWSERS = /^(Chrome|Firefox|Safari|Edge|Browser)\b/;

export function activeLabel(iso: string | null): string {
  if (!iso) return 'Unknown';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 2) return 'Active now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} h ago`;
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

const dateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown');

const SessionsSettings: React.FC = () => {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [mine, setMine] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/api/v1/e2e/v2/devices/me').then((r) => r.data.data.devices as Session[]),
      v2Runtime()?.then((r) => r.state.deviceId).catch(() => null) ?? Promise.resolve(null),
    ]).then(([data, me]) => {
      setSessions([...data].sort((a, b) => Number(b.device_id === me) - Number(a.device_id === me)
        || new Date(b.last_seen_at || 0).getTime() - new Date(a.last_seen_at || 0).getTime()));
      setMine(me);
    }).catch((e) => setError(parseApiError(e)));
  }, []);

  return (
    <div className="card p-4 sm:p-6">
      <div className="flex gap-3">
        <MonitorSmartphone className="w-6 h-6 text-primary-600 flex-shrink-0" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-muted-900">Sessions</h2>
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(LINK_DEVICE_EVENT))}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary-700 hover:bg-primary-800 rounded-lg">
              <QrCode className="w-4 h-4" /> Link a device
            </button>
          </div>
          <p className="text-sm text-muted-500">Phones and browsers signed in to your account. Logging out on a device ends its session.</p>
          {error && <p className="mt-2 text-sm text-accent-600">{error}</p>}
          <ul className="mt-4 space-y-2" aria-label="Active sessions">
            {sessions?.map((s) => {
              const Icon = BROWSERS.test(s.name) ? Globe : Smartphone;
              const current = s.device_id === mine;
              return (
                <li key={s.device_id} className={`flex gap-3 p-3 rounded-xl border ${current ? 'border-primary-300 bg-primary-50/40' : 'border-muted-200'}`}>
                  <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${current ? 'bg-primary-700 text-white' : 'bg-primary-50 text-primary-700'}`}>
                    <Icon className="w-5 h-5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-muted-900">
                      <span className="truncate">{s.name}</span>
                      {current && <span className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-800 text-[11px] font-bold">This device</span>}
                    </p>
                    <p className="text-sm text-muted-700">{current ? 'Active now' : activeLabel(s.last_seen_at)}</p>
                    <p className="text-xs text-muted-500">Signed in {dateTime(s.created_at)}</p>
                    <p className={`mt-0.5 flex items-center gap-1 text-xs ${s.linked ? 'text-success-700' : 'text-warning-700'}`}>
                      {s.linked ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                      {s.linked ? 'Linked: can read your encrypted chats' : 'Not linked yet: waiting to be approved'}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SessionsSettings;
