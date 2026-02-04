// src/components/organisms/ChatHeader/index.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Conversation } from '../../../types/chat.types';

interface ChatHeaderProps {
  conversation: Conversation;
  currentUserId: string;
  onlineUsers: Set<string>;
  onViewProfile?: (userId: string) => void;
  onViewGroupDetails?: (groupId: string) => void;
  onBack?: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversation,
  currentUserId,
  onlineUsers,
  onViewProfile,
  onViewGroupDetails,
  onBack,
}) => {
  const navigate = useNavigate();
  const [showContextMenu, setShowContextMenu] = useState(false);

  // Get other user ID for DM
  const otherUserId = conversation.isGroup 
    ? null 
    : conversation.members.find(id => id !== currentUserId);

  const isOnline = otherUserId ? onlineUsers.has(otherUserId) : false;

  const handleHeaderClick = () => {
    if (conversation.isGroup) {
      // Navigate to group details page
      if (onViewGroupDetails) {
        onViewGroupDetails(conversation.id);
      } else {
        navigate(`/group/${conversation.id}`);
      }
    } else {
      // Navigate to user profile page
      if (otherUserId) {
        if (onViewProfile) {
          onViewProfile(otherUserId);
        } else {
          navigate(`/user/${otherUserId}`);
        }
      }
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
      {/* Back button (mobile) */}
      {onBack && (
        <button
          onClick={onBack}
          className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Avatar + Info (clickable) */}
      <button
        onClick={handleHeaderClick}
        className="flex items-center gap-3 flex-1 min-w-0 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors text-left"
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
            {conversation.name.charAt(0).toUpperCase()}
          </div>
          {!conversation.isGroup && isOnline && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
          )}
        </div>

        {/* Name + Status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-900 truncate">
              {conversation.name}
            </h2>
            {conversation.isGroup && (
              <span className="text-xs text-gray-500">
                ({conversation.members.length})
              </span>
            )}
          </div>
          
          {/* Status */}
          {conversation.isGroup ? (
            <p className="text-xs text-gray-500 truncate">
              {conversation.members.length} members
            </p>
          ) : (
            <p className={`text-xs ${isOnline ? 'text-green-600' : 'text-gray-500'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </p>
          )}
        </div>
      </button>

      {/* Context Menu Button */}
      <div className="relative">
        <button
          onClick={() => setShowContextMenu(!showContextMenu)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>

        {/* Context Menu Dropdown */}
        {showContextMenu && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setShowContextMenu(false)}
            />
            
            {/* Menu */}
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
              <button
                onClick={() => {
                  handleHeaderClick();
                  setShowContextMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <span>ℹ️</span>
                <span>{conversation.isGroup ? 'Group Details' : 'View Profile'}</span>
              </button>
              
              {!conversation.isGroup && (
                <button
                  onClick={() => {
                    if (otherUserId) {
                      navigate(`/user/${otherUserId}`);
                    }
                    setShowContextMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <span>👤</span>
                  <span>View Profile</span>
                </button>
              )}
              
              <button
                onClick={() => {
                  // TODO: Implement search in conversation
                  setShowContextMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <span>🔍</span>
                <span>Search</span>
              </button>
              
              <hr className="my-1 border-gray-200" />
              
              <button
                onClick={() => {
                  // TODO: Implement mute
                  setShowContextMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <span>🔕</span>
                <span>Mute</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatHeader;