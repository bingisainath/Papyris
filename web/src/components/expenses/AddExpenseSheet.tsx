// src/components/expenses/AddExpenseSheet.tsx
// "Add expense" from a chat: scan a receipt or enter it by hand. Also used to edit.

import React, { useState } from 'react';
import type { Expense } from '../../services/expense.service';
import ManualExpenseForm from './ManualExpenseForm';
import ReceiptScan from './ReceiptScan';
import { Segmented, Sheet, useChatMoney } from './shared';

interface Props {
  conversationId: string;
  currentUserId: string;
  expense?: Expense; // edit a manual expense (or the details of a receipt one)
  receiptId?: string; // continue reviewing a receipt
  initialTab?: 'scan' | 'manual';
  onClose: () => void;
  onSaved?: (expense: Expense) => void;
}

const AddExpenseSheet: React.FC<Props> = ({ conversationId, currentUserId, expense, receiptId, initialTab, onClose, onSaved }) => {
  const [tab, setTab] = useState<'scan' | 'manual'>(receiptId ? 'scan' : expense ? 'manual' : initialTab || 'scan');
  const { members, settings } = useChatMoney(conversationId);

  const done = (saved: Expense) => {
    onSaved?.(saved);
    onClose();
  };

  return (
    <Sheet title={expense ? 'Edit expense' : receiptId ? 'Receipt' : 'Add expense'} onClose={onClose} wide={tab === 'scan'}>
      {!expense && !receiptId && (
        <div className="flex justify-center mb-4">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[{ value: 'scan', label: '📷 Scan receipt' }, { value: 'manual', label: '✏️ Enter manually' }]}
          />
        </div>
      )}
      {!members.length || !settings ? (
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" />
        </div>
      ) : tab === 'scan' ? (
        <ReceiptScan
          conversationId={conversationId}
          members={members}
          currentUserId={currentUserId}
          receiptId={receiptId}
          onSaved={done}
          onManual={() => setTab('manual')}
          onClose={onClose}
        />
      ) : (
        <ManualExpenseForm
          conversationId={conversationId}
          members={members}
          currentUserId={currentUserId}
          defaultCurrency={settings.default_currency}
          expense={expense}
          onDone={done}
        />
      )}
    </Sheet>
  );
};

export default AddExpenseSheet;
