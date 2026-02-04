// src/components/organisms/UserProfileModal/index.tsx

import React, { useState, useEffect } from 'react';
import { userService } from '../../../services/user.service';
import { chatService } from '../../../services/chat.service';
import { useBlockUser } from '../../../hooks/useBlockUser';
import type { User } from '../../../types/user.types';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentUserId: string;
  token: string;
  onStartChat?: (conversationId: string) => void;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  userId,
  currentUserId,
  token,
  onStartChat,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState(false);
  
  const { isBlocked, blocking, blockUser, unblockUser } = useBlockUser(userId, token);

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserProfile();
    }
  }, [isOpen, userId]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const response = await userService.getUserProfile(userId, token);
      if (response.success && response.data) {
        setUser(response.data);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async () => {
    if (!user) return;
    
    try {
      setStartingChat(true);
      const response = await chatService.createConversation('dm', [user.id], token);
      if (response.success && response.data) {
        if (onStartChat) {
          onStartChat(response.data.id);
        }
        onClose();
      }
    } catch (error) {
      console.error('Error starting chat:', error);
      alert('Failed to start conversation');
    } finally {
      setStartingChat(false);
    }
  };

  const handleBlockToggle = async () => {
    try {
      if (isBlocked) {
        await unblockUser();
      } else {
        if (window.confirm(`Block ${user?.username}? They won't be able to message you.`)) {
          await blockUser();
        }
      }
    } catch (error) {
      alert('Failed to update block status');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden animate-scale-in">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : !user ? (
          <div className="p-12 text-center">
            <span className="text-6xl mb-4">😕</span>
            <h2 className="text-xl font-bold text-gray-900 mb-2">User not found</h2>
            <button
              onClick={onClose}
              className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Header with gradient */}
            <div className="relative">
              <div className="h-32 bg-gradient-to-br from-purple-600 to-pink-500" />
              
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-lg transition-colors"
              >
                <span className="text-white text-xl">×</span>
              </button>

              {/* Avatar */}
              <div className="absolute left-1/2 transform -translate-x-1/2 -bottom-12">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-white shadow-xl flex items-center justify-center text-purple-600 text-3xl font-bold border-4 border-white">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  {user.is_online && (
                    <div className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 border-4 border-white rounded-full"></div>
                  )}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="pt-16 px-6 pb-6 space-y-6">
              {/* Name & Status */}
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  {user.username}
                </h2>
                <p className="text-gray-600 text-sm">{user.email}</p>
                {user.is_online ? (
                  <p className="text-green-600 text-sm mt-2 flex items-center justify-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Online
                  </p>
                ) : user.last_seen ? (
                  <p className="text-gray-500 text-sm mt-2">
                    Last seen {new Date(user.last_seen).toLocaleString()}
                  </p>
                ) : null}
              </div>

              {/* Bio */}
              {user.bio && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">About</h3>
                  <p className="text-gray-600 text-sm">{user.bio}</p>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={handleStartChat}
                  disabled={isBlocked || startingChat}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {startingChat ? 'Starting...' : isBlocked ? 'User Blocked' : '💬 Send Message'}
                </button>

                <button
                  onClick={handleBlockToggle}
                  disabled={blocking}
                  className={`
                    w-full px-4 py-3 rounded-xl font-medium transition-all
                    ${
                      isBlocked
                        ? 'border-2 border-green-300 text-green-600 hover:bg-green-50'
                        : 'border-2 border-red-300 text-red-600 hover:bg-red-50'
                    }
                    disabled:opacity-50
                  `}
                >
                  {blocking ? 'Processing...' : isBlocked ? '✓ Unblock User' : '🚫 Block User'}
                </button>
              </div>

              {/* Info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Member since</span>
                  <span className="text-gray-900 font-semibold">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Blocked Info */}
              {isBlocked && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                  <div className="flex gap-2">
                    <span className="text-red-600">⚠️</span>
                    <div className="text-sm">
                      <p className="font-semibold text-red-900 mb-1">User is blocked</p>
                      <p className="text-red-700">
                        You won't receive messages from this user. Unblock to start chatting again.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UserProfileModal;