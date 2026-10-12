// src/hooks/useDisplayCurrency.ts
// The currency chosen in Settings → "Show totals in", and a converter to it (same as web).
// Converted amounts are only ever shown as "≈", never used for balances or payments.
import { useCallback, useEffect, useState } from 'react';
import { expenseService } from '../api/expenses';
import { useAuth } from '../store/auth';
import { convertMinor, formatMinor } from '../utils/money';

// Rates per target currency, shared by every screen for an hour
const cache: Record<string, { at: number; rates: Record<string, number>; updated: string | null }> = {};
const FOR_MS = 60 * 60 * 1000;

export function useDisplayCurrency() {
  const target = useAuth((s) => s.user?.display_currency) || null;
  const [entry, setEntry] = useState(target ? cache[target] || null : null);
  useEffect(() => {
    if (!target) { setEntry(null); return; }
    const cached = cache[target];
    if (cached && Date.now() - cached.at < FOR_MS) { setEntry(cached); return; }
    let alive = true;
    expenseService.exchangeRates(target)
      .then((r) => { cache[target] = { at: Date.now(), rates: r.rates, updated: r.updated }; if (alive) setEntry(cache[target]); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [target]);
  const convert = useCallback(
    (minor: number, from: string) => (target && entry ? convertMinor(minor, from, target, entry.rates) : null),
    [target, entry],
  );
  /** "≈ US$12.40", or '' when it's off, the same currency, or there's no rate */
  const approx = useCallback((minor: number, from: string) => {
    if (!target || from === target) return '';
    const v = convert(minor, from);
    return v === null ? '' : `≈ ${v < 0 ? '−' : ''}${formatMinor(Math.abs(v), target)}`;
  }, [target, convert]);
  return { target, convert, approx, updated: entry?.updated || null };
}
