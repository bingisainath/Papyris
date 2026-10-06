// src/screens/expenses/useMembers.ts
import { useEffect, useState } from 'react';
import { chatApi, MemberInfo } from '../../api/chat';
import { expenseService, ExpenseSettings } from '../../api/expenses';
import { onServerEvent } from '../../store/chat';

export const memberName = (m?: { name?: string | null; username?: string } | null) => (m ? m.name || m.username || 'Someone' : 'Someone');

/** A chat's members and expense settings. */
export function useChatMoney(conversationId?: string) {
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [settings, setSettings] = useState<ExpenseSettings | null>(null);
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    Promise.all([chatApi.details(conversationId), expenseService.settings(conversationId)])
      .then(([d, s]) => { if (!cancelled) { setMembers(d.members); setSettings(s); } })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [conversationId]);
  return { members, settings };
}

/** Re-run `callback` when an expense or payment changes in this chat (any device). */
export function useExpenseChanges(conversationId: string | undefined, callback: () => void) {
  useEffect(() => onServerEvent((e) => {
    if (e.type === 'expense_changed' && e.conversationId === conversationId) callback();
  }), [conversationId, callback]);
}
