// src/components/organisms/ConfirmDialog.tsx
// The app's own confirm dialog, in place of the browser's window.confirm (which can't be styled):
//
//   if (!(await confirmDialog({ title: 'Undo this payment?', message: '…', confirmText: 'Undo', danger: true }))) return;
//
// <ConfirmHost /> sits once at the root (App.tsx).

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string; // default "OK"
  cancelText?: string; // default "Cancel"
  danger?: boolean; // red confirm button for deleting or undoing
}

interface Pending extends ConfirmOptions {
  id: number;
  resolve: (ok: boolean) => void;
}

let queue: Pending[] = [];
let nextId = 1;
const listeners = new Set<(q: Pending[]) => void>();
const emit = () => listeners.forEach((l) => l(queue));

/** Resolves true when the person confirms, false when they cancel or close it. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    queue = [...queue, { ...options, id: nextId++, resolve }];
    emit();
  });
}

export const ConfirmHost: React.FC = () => {
  const [items, setItems] = useState<Pending[]>(queue);
  const confirmButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    listeners.add(setItems);
    return () => { listeners.delete(setItems); };
  }, []);

  const current = items[0];
  useEffect(() => { confirmButton.current?.focus(); }, [current?.id]);
  if (!current) return null;

  const close = (ok: boolean) => {
    current.resolve(ok);
    queue = queue.filter((p) => p.id !== current.id);
    emit();
  };
  const Icon = current.danger ? AlertTriangle : HelpCircle;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#18121f]/60 backdrop-blur-[3px] p-4"
      onClick={() => close(false)} onKeyDown={(e) => { if (e.key === 'Escape') close(false); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby={`confirm-${current.id}`} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-[20px] shadow-elevated p-6">
        <div className="flex gap-3">
          <span className={`w-10 h-10 flex-shrink-0 rounded-xl grid place-items-center ${current.danger ? 'bg-accent-50 text-accent-600' : 'bg-primary-50 text-primary-700'}`}>
            <Icon className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h2 id={`confirm-${current.id}`} className="font-display text-lg font-semibold text-muted-900">{current.title}</h2>
            {current.message && <p className="mt-1 text-sm text-muted-600">{current.message}</p>}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => close(false)} className="h-10 px-4 rounded-[11px] text-sm font-semibold text-muted-600 hover:bg-muted-100">
            {current.cancelText || 'Cancel'}
          </button>
          <button ref={confirmButton} type="button" onClick={() => close(true)}
            className={`h-10 px-4 rounded-[11px] text-sm font-bold text-white ${current.danger ? 'bg-accent-600 hover:bg-accent-700' : 'bg-primary-700 hover:bg-primary-800'}`}>
            {current.confirmText || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};
