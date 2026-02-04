// src/pages/UserProfile/index.tsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { userService } from '../../services/user.service';
import { chatService } from '../../services/chat.service';
import { useBlockUser } from '../../hooks/useBlockUser';
import type { User } from '../../types/user.types';

interface UserProfilePageProps {
  currentUserId: string;
  token: string;
  onStartChat?: (userId: string) => void;
}

const UserProfilePage: React.FC<UserProfilePageProps> = ({ 
  currentUserId, 
  token,
  onStartChat 
}) => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  const { isBlocked, blocking, blockUser, unblockUser } = useBlockUser(userId!, token);

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
    }
  }, [userId]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const response = await userService.getUserProfile(userId!, token);
      if (response.success && response.data) {
        setUser(response.data);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      alert('Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async () => {
    if (!user) return;
    
    try {
      // Create or get existing DM conversation
      const response = await chatService.createConversation('dm', [user.id], token);
      if (response.success && response.data) {
        if (onStartChat) {
          onStartChat(user.id);
        } else {
          navigate(`/chat/${response.data.id}`);
        }
      }
    } catch (error) {
      console.error('Error starting chat:', error);
      alert('Failed to start conversation');
    }
  };

  const handleBlockToggle = async () => {
    try {
      if (isBlocked) {
        await unblockUser();
      } else {
        if (window.confirm(`Block ${user?.username}?`)) {
          await blockUser();
        }
      }
    } catch (error) {
      alert('Failed to update block status');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <span className="text-6xl mb-4">👤</span>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">User not found</h2>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-gray-50 to-purple-50">
      <div className="max-w-2xl mx-auto">
        {/* Header with gradient */}
        <div className="relative">
          <div className="absolute inset-0 h-40 bg-gradient-to-br from-purple-600 to-pink-500" />
          
          {/* Back button */}
          <div className="relative pt-6 px-6">
            <button
              onClick={() => navigate(-1)}
              className="p-2 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-lg transition-colors"
            >
              <span className="text-white">← Back</span>
            </button>
          </div>

          {/* Avatar */}
          <div className="relative flex justify-center mt-8 pb-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-white shadow-xl flex items-center justify-center text-purple-600 text-3xl font-bold">
                {user.username.charAt(0).toUpperCase()}
              </div>
              {user.is_online && (
                <div className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 border-4 border-white rounded-full"></div>
              )}
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="px-6 pb-6 space-y-6">
          {/* Name & Status */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-1">{user.username}</h1>
            <p className="text-gray-600">{user.email}</p>
            {user.is_online ? (
              <p className="text-green-600 text-sm mt-2">● Online</p>
            ) : user.last_seen ? (
              <p className="text-gray-500 text-sm mt-2">
                Last seen {new Date(user.last_seen).toLocaleString()}
              </p>
            ) : null}
          </div>

          {/* Bio */}
          {user.bio && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Bio</h2>
              <p className="text-gray-600">{user.bio}</p>
            </div>
          )}

          {/* Actions */}
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-3">
            <button
              onClick={handleStartChat}
              disabled={isBlocked}
              className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBlocked ? 'User Blocked' : 'Start Conversation'}
            </button>

            <button
              onClick={handleBlockToggle}
              disabled={blocking}
              className={`
                w-full px-4 py-3 rounded-xl font-medium
                ${
                  isBlocked
                    ? 'border-2 border-green-300 text-green-600 hover:bg-green-50'
                    : 'border-2 border-red-300 text-red-600 hover:bg-red-50'
                }
                disabled:opacity-50
              `}
            >
              {blocking ? 'Processing...' : isBlocked ? 'Unblock User' : 'Block User'}
            </button>
          </div>

          {/* Member Since */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Member since</span>
              <span className="text-gray-900 font-semibold">
                {new Date(user.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;