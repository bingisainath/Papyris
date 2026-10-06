// src/components/expenses/shared.tsx
// Small pieces shared by the expense screens.

import React, { useCallback, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Avatar } from '../atoms';
import { chatService } from '../../services/chat.service';
import type { ConversationMemberInfo } from '../../services/chat.service';
import { expenseService } from '../../services/expense.service';
import type { ExpenseSettings } from '../../services/expense.service';
import { EXPENSE_CHANGED_EVENT } from '../../utils/events';
import { decimalsFor, formatMinor, parseMajor } from '../../utils/money';

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
      if ((e as CustomEvent).detail?.conversationId === conversationId) callback();
    };
    window.addEventListener(EXPENSE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(EXPENSE_CHANGED_EVENT, onChange);
  }, [conversationId, callback]);
}

export const Sheet: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}> = ({ title, onClose, children, footer, wide }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className={`flex flex-col w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} h-[100dvh] sm:h-auto sm:max-h-[90vh] bg-white sm:rounded-2xl shadow-elevated`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-muted-200">
          <h2 className="text-lg font-semibold text-muted-900 truncate">{title}</h2>
          <button onClick={onClose} className="p-2 -mr-2 rounded-lg hover:bg-muted-100" aria-label="Close">
            <svg className="w-5 h-5 text-muted-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">{children}</div>
        {footer && <div className="px-4 sm:px-6 py-3 border-t border-muted-200 mobile-nav-safe">{footer}</div>}
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
  <div className="inline-flex p-0.5 bg-muted-100 rounded-lg" role="tablist">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        role="tab"
        aria-selected={value === o.value}
        onClick={() => onChange(o.value)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
          value === o.value ? 'bg-white text-primary-700 font-semibold shadow-sm' : 'text-muted-600 hover:text-muted-900'
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
