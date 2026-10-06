// src/utils/money.ts
// Amounts travel as integers in the currency's minor unit (cents, paise). Never do money maths in floats.

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  decimals: number;
}

// Kept in sync with backend/app/services/money.py (the server is the source of truth)
const DECIMALS: Record<string, number> = { JPY: 0, KRW: 0, KWD: 3, BHD: 3, OMR: 3 };

export const COMMON_CURRENCIES = ['EUR', 'INR', 'USD', 'GBP'];

export const decimalsFor = (currency: string) => DECIMALS[currency?.toUpperCase()] ?? 2;

export function formatMinor(minor: number | null | undefined, currency: string): string {
  if (minor === null || minor === undefined) return '';
  const decimals = decimalsFor(currency);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(minor / 10 ** decimals);
  } catch {
    return `${(minor / 10 ** decimals).toFixed(decimals)} ${currency}`;
  }
}

/** Minor units -> editable text, e.g. 1230 -> "12.30" */
export function toMajorString(minor: number, currency: string): string {
  const decimals = decimalsFor(currency);
  const negative = minor < 0;
  const digits = String(Math.abs(minor)).padStart(decimals + 1, '0');
  const whole = decimals ? digits.slice(0, -decimals) : digits;
  const fraction = decimals ? `.${digits.slice(-decimals)}` : '';
  return `${negative ? '-' : ''}${whole}${fraction}`;
}

/** "12,30" / "12.3" -> 1230, or null if it isn't a number. Parsed as text, so no float rounding. */
export function parseMajor(text: string, currency: string): number | null {
  const cleaned = text.trim().replace(/\s/g, '').replace(/[^\d.,-]/g, '');
  if (!cleaned) return null;
  const lastSep = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf(','));
  let whole = cleaned;
  let fraction = '';
  if (lastSep >= 0 && cleaned.length - lastSep - 1 <= 3 && cleaned.length - lastSep - 1 > 0) {
    whole = cleaned.slice(0, lastSep);
    fraction = cleaned.slice(lastSep + 1);
  }
  whole = whole.replace(/[.,]/g, '');
  const negative = whole.startsWith('-');
  whole = whole.replace('-', '');
  if (!/^\d*$/.test(whole) || !/^\d*$/.test(fraction) || (!whole && !fraction)) return null;
  const decimals = decimalsFor(currency);
  const padded = (fraction + '0'.repeat(decimals + 1)).slice(0, decimals + 1);
  let minor = Number(whole || '0') * 10 ** decimals + Number(padded.slice(0, decimals) || '0');
  if (Number(padded[decimals]) >= 5) minor += 1; // round half up like the server
  return negative ? -minor : minor;
}
