// src/components/expenses/shared.tsx
// Small pieces shared by the expense screens.

import React, { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Avatar } from '../atoms';
import { chatService } from '../../services/chat.service';
import type { ConversationMemberInfo } from '../../services/chat.service';
import { expenseService } from '../../services/expense.service';
import type { ExpenseSettings } from '../../services/expense.service';
import { EXPENSE_CHANGED_EVENT } from '../../utils/events';
import { convertMinor, decimalsFor, formatMinor, parseMajor } from '../../utils/money';
import { useAuth } from '../../app/AuthProvider';

export type Member = ConversationMemberInfo;

export const displayName = (m?: { name?: string | null; username?: string } | null) =>
  m ? (m.name || m.username || 'Someone') : 'Someone';

export const firstName = (m?: { name?: string | null; username?: string } | null) =>
  displayName(m).split(' ')[0];

/** Members of a chat plus its expense settings. */
export function useChatMoney(conversationId: string | undefined) {
  const [members, setMembers] = useState<Member[]>([]);
  const [settings, setSettings] = useState<ExpenseSettings | null>(null);
  const [isDm, setIsDm] = useState(false);

  const load = useCallback(async () => {
    if (!conversationId) return;
    const [details, chatSettings] = await Promise.all([
      chatService.getConversation(conversationId),
      expenseService.settings(conversationId),
    ]);
    setMembers(details.members);
    setIsDm(details.kind === 'dm');
    setSettings(chatSettings);
  }, [conversationId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.conversationId === conversationId && detail.action === 'settings') load().catch(() => undefined);
    };
    window.addEventListener(EXPENSE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(EXPENSE_CHANGED_EVENT, onChange);
  }, [conversationId, load]);

  return { members, settings, isDm, reload: load };
}

/** Re-run `callback` whenever an expense in this chat changes (any device, any member). */
export function useExpenseChanges(conversationId: string | undefined, callback: () => void) {
  useEffect(() => {
    const onChange = (e: Event) => {
      // No chat id: any chat's change (e.g. the Expenses home totals)
      if (conversationId === undefined || (e as CustomEvent).detail?.conversationId === conversationId) callback();
    };
    window.addEventListener(EXPENSE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(EXPENSE_CHANGED_EVENT, onChange);
  }, [conversationId, callback]);
}

export const Sheet: React.FC<{
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}> = ({ title, eyebrow, onClose, children, footer, wide }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-5 bg-[#18121f]/60 backdrop-blur-[3px]" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className={`flex flex-col w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-[620px]'} max-h-[94dvh] sm:max-h-[92vh] bg-white rounded-t-[22px] sm:rounded-[20px] shadow-[0_30px_80px_rgba(0,0,0,0.33)]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 sm:py-5 border-b border-muted-200">
          <div className="min-w-0">
            {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary-500 truncate">{eyebrow}</p>}
            <h2 className="font-display text-xl sm:text-[22px] font-semibold text-muted-900 truncate">{title}</h2>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 rounded-lg text-muted-500 hover:bg-muted-100" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">{children}</div>
        {footer && <div className="px-5 sm:px-6 py-4 border-t border-muted-200 mobile-nav-safe">{footer}</div>}
      </div>
    </div>
  );
};

/** Round avatar that toggles a person on/off ("who is this for?"). */
export const PersonToggle: React.FC<{
  member: Member;
  selected: boolean;
  onToggle: () => void;
  size?: 'xs' | 'sm' | 'md';
  label?: string;
}> = ({ member, selected, onToggle, size = 'sm', label }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={selected}
    title={displayName(member)}
    className={`flex flex-col items-center gap-0.5 rounded-full transition-all ${selected ? '' : 'opacity-35 grayscale'}`}
  >
    <span className={`rounded-full ${selected ? 'ring-2 ring-primary-500 ring-offset-1' : ''}`}>
      <Avatar src={member.avatar} alt={displayName(member)} size={size} />
    </span>
    {label !== undefined && <span className="text-[10px] leading-none text-muted-600 max-w-[3.5rem] truncate">{label}</span>}
  </button>
);

/** Text box for an amount in major units ("12.30"); keeps what the person typed. */
export const MoneyInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  currency: string;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
  allowNegative?: boolean;
}> = ({ value, onChange, currency, placeholder, className = '', autoFocus, ariaLabel, allowNegative }) => {
  const invalid = value.trim() !== '' && (parseMajor(value, currency) === null || (!allowNegative && (parseMajor(value, currency) ?? 0) < 0));
  return (
    <input
      inputMode="decimal"
      value={value}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      aria-invalid={invalid}
      placeholder={placeholder ?? (decimalsFor(currency) ? '0.00' : '0')}
      onChange={(e) => onChange(e.target.value)}
      className={`px-3 py-2 rounded-lg border bg-white text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500 ${
        invalid ? 'border-accent-500' : 'border-muted-300'
      } ${className}`}
    />
  );
};

// Exchange rates per target currency, shared by every screen for an hour
const rateCache: Record<string, { at: number; rates: Record<string, number>; updated: string | null }> = {};
const RATES_FOR_MS = 60 * 60 * 1000;

/**
 * The currency chosen in Settings → "Show totals in", and a converter to it (null when it's off
 * or there's no rate). Converted amounts are only ever shown as "≈", never used for balances.
 */
export function useDisplayCurrency() {
  const { user } = useAuth();
  const target = user?.display_currency || null;
  const [entry, setEntry] = useState(target ? rateCache[target] || null : null);
  useEffect(() => {
    if (!target) { setEntry(null); return; }
    const cached = rateCache[target];
    if (cached && Date.now() - cached.at < RATES_FOR_MS) { setEntry(cached); return; }
    let alive = true;
    expenseService.exchangeRates(target)
      .then((r) => { rateCache[target] = { at: Date.now(), rates: r.rates, updated: r.updated }; if (alive) setEntry(rateCache[target]); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [target]);
  const convert = useCallback(
    (minor: number, from: string) => (target && entry ? convertMinor(minor, from, target, entry.rates) : null),
    [target, entry],
  );
  return { target, convert, updated: entry?.updated || null };
}

/** "≈ $12.40" next to an amount in another currency, when a display currency is set. */
export const Approx: React.FC<{ minor: number; currency: string; className?: string; signed?: boolean }> = ({ minor, currency, className, signed }) => {
  const { target, convert } = useDisplayCurrency();
  if (!target || target === currency) return null;
  const converted = convert(minor, currency);
  if (converted === null) return null;
  const sign = signed ? (converted > 0 ? '+' : converted < 0 ? '−' : '') : converted < 0 ? '−' : '';
  return <span className={`tabular-nums ${className || 'text-xs text-muted-400'}`} title="Converted at today's rate">≈ {sign}{formatMinor(Math.abs(converted), target)}</span>;
};

export const Money: React.FC<{ minor: number | null | undefined; currency: string; className?: string }> = ({ minor, currency, className }) => (
  <span className={`tabular-nums ${className || ''}`}>{formatMinor(minor, currency)}</span>
);

export const Segmented = <T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; icon?: LucideIcon }[];
  onChange: (value: T) => void;
}) => (
  <div className="inline-flex p-[3px] bg-[#f1f0f5] rounded-[11px]" role="tablist">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        role="tab"
        aria-selected={value === o.value}
        onClick={() => onChange(o.value)}
        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-[9px] transition-colors ${
          value === o.value ? 'bg-white text-primary-700 shadow-[0_2px_7px_rgba(0,0,0,0.07)]' : 'text-muted-500 hover:text-muted-900'
        }`}
      >
        {o.icon && <o.icon className="w-4 h-4" strokeWidth={1.75} aria-hidden />}
        {o.label}
      </button>
    ))}
  </div>
);

export const Switch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }> = ({
  checked, onChange, label, disabled,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-primary-600' : 'bg-muted-300'}`}
  >
    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
  </button>
);

export const CurrencySelect: React.FC<{ value: string; onChange: (code: string) => void; className?: string }> = ({ value, onChange, className }) => {
  const [codes, setCodes] = useState<{ code: string; name: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    expenseService.currencies().then((list) => !cancelled && setCodes(list)).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  const options = codes.length ? codes : [{ code: value, name: value }];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Currency"
      className={`px-2 py-2 rounded-lg border border-muted-300 bg-white text-sm ${className || ''}`}
    >
      {options.map((c) => (
        <option key={c.code} value={c.code}>{c.code}{c.name !== c.code ? ` · ${c.name}` : ''}</option>
      ))}
    </select>
  );
};
