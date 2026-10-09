// src/utils/pay.ts
// "Pay" buttons: open the payee's payment app with the amount filled in where the app allows it.
// Papyris never moves money; the payer records the payment afterwards.

export interface PayHandles { revolut?: string; paypal?: string; upi?: string }

export interface PayOption {
  app: 'revolut' | 'paypal' | 'upi';
  label: string;
  url: string;
  /** The link can't carry the amount: copy it first so it can be pasted. */
  copyAmount?: boolean;
}

/** 1602 EUR -> "16.02" */
const major = (minor: number, decimals: number) => (minor / 10 ** decimals).toFixed(decimals);

export function payOptions(pay: PayHandles | undefined, amountMinor: number, currency: string, decimals: number, payeeName: string, note: string): PayOption[] {
  if (!pay) return [];
  const amount = major(amountMinor, decimals);
  const out: PayOption[] = [];
  if (pay.revolut) out.push({ app: 'revolut', label: 'Revolut', url: `https://revolut.me/${encodeURIComponent(pay.revolut)}`, copyAmount: true });
  if (pay.paypal) out.push({ app: 'paypal', label: 'PayPal', url: `https://paypal.me/${encodeURIComponent(pay.paypal)}/${amount}${currency}` });
  if (pay.upi && currency === 'INR') {
    const q = new URLSearchParams({ pa: pay.upi, pn: payeeName, am: amount, cu: 'INR', tn: note.slice(0, 50) });
    out.push({ app: 'upi', label: 'UPI', url: `upi://pay?${q.toString()}` });
  }
  return out;
}
