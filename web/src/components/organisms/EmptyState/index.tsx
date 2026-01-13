/**
 * EmptyState Component
 * Shows when there are no conversations
 * Features better, more intuitive icons for actions
 */
import React from 'react';
import { MessageSquarePlus, UsersRound, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  onNewChat: () => void;
  onNewGroup: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onNewChat,
  onNewGroup,
}) => {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-12">
      {/* Icon and Main Message */}
      <div className="relative mb-8">
        {/* Background glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full blur-2xl opacity-20 animate-pulse"></div>
        
        {/* Main icon */}
        <div className="relative w-32 h-32 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center">
          <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
        </div>
      </div>

      {/* Text Content */}
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        No conversations yet
      </h2>
      <p className="text-gray-500 text-center max-w-md mb-8">
        Start a new conversation or create a group to begin messaging
      </p>

      {/* Action Buttons with Better Icons */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        {/* New Chat Button - Using MessageSquarePlus for clarity */}
        <button
          onClick={onNewChat}
          className="flex-1 group relative overflow-hidden px-6 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all transform hover:scale-105 hover:shadow-xl"
        >
          {/* Shine effect on hover */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 transform -skew-x-12 group-hover:translate-x-full transition-all duration-700"></div>
          
          <div className="relative flex items-center justify-center gap-3">
            <MessageSquarePlus className="w-6 h-6" />
            <div className="text-left">
              <p className="font-semibold text-lg">New Chat</p>
              <p className="text-xs text-purple-100">Start 1-on-1 conversation</p>
            </div>
          </div>
        </button>

        {/* New Group Button - Using UsersRound for clarity */}
        <button
          onClick={onNewGroup}
          className="flex-1 group relative overflow-hidden px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all transform hover:scale-105 hover:shadow-xl"
        >
          {/* Shine effect on hover */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 transform -skew-x-12 group-hover:translate-x-full transition-all duration-700"></div>
          
          <div className="relative flex items-center justify-center gap-3">
            <UsersRound className="w-6 h-6" />
            <div className="text-left">
              <p className="font-semibold text-lg">New Group</p>
              <p className="text-xs text-blue-100">Create group chat</p>
            </div>
          </div>
        </button>
      </div>

      {/* Additional Info */}
      <div className="mt-12 flex items-center gap-8 text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
            <MessageSquarePlus className="w-4 h-4 text-purple-600" />
          </div>
          <span>Direct Messages</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <UsersRound className="w-4 h-4 text-blue-600" />
          </div>
          <span>Group Chats</span>
        </div>
      </div>
    </div>
  );
};

export default EmptyState;