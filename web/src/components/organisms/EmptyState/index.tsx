/**
 * EmptyState Component
 * Shown in the chat area when no conversation is open.
 */
import React from 'react';
import { MessageSquarePlus, MessagesSquare, UsersRound } from 'lucide-react';

interface EmptyStateProps {
  onNewChat: () => void;
  onNewGroup: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onNewChat, onNewGroup }) => (
  <div className="flex flex-col items-center justify-center h-full px-6 py-12 bg-muted-50">
    <div className="w-16 h-16 mb-5 rounded-full bg-primary-50 flex items-center justify-center">
      <MessagesSquare className="w-8 h-8 text-primary-700" strokeWidth={1.75} />
    </div>
    <h2 className="text-xl font-semibold text-muted-900">Select a conversation</h2>
    <p className="mt-1 mb-8 text-sm text-muted-500 text-center max-w-sm">
      Choose a chat from the list, or start a new one. You can split expenses in any chat.
    </p>
    <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
      <button
        type="button"
        onClick={onNewChat}
        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium transition-colors"
      >
        <MessageSquarePlus className="w-4 h-4" /> New chat
      </button>
      <button
        type="button"
        onClick={onNewGroup}
        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-muted-300 bg-white hover:bg-muted-50 text-muted-800 text-sm font-medium transition-colors"
      >
        <UsersRound className="w-4 h-4" /> New group
      </button>
    </div>
  </div>
);

export default EmptyState;
