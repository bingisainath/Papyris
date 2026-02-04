// src/pages/BlockedUsers/index.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../../services/user.service';
import type { BlockedUser } from '../../types/user.types';

interface BlockedUsersPageProps {
  token: string;
}

const BlockedUsersPage: React.FC<BlockedUsersPageProps> = ({ token }) => {
  const navigate = useNavigate();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const fetchBlockedUsers = async () => {
    try {
      setLoading(true);
      const response = await userService.getBlockedUsers(token);
      if (response.success && response.data) {
        setBlockedUsers(response.data.blocked_users);
      }
    } catch (error) {
      console.error('Error fetching blocked users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (userId: string, username: string) => {
    if (!window.confirm(`Unblock ${username}?`)) return;

    try {
      setUnblocking(userId);
      await userService.unblockUser(userId, token);
      setBlockedUsers(blockedUsers.filter(user => user.id !== userId));
    } catch (error) {
      console.error('Error unblocking user:', error);
      alert('Failed to unblock user');
    } finally {
      setUnblocking(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-gray-50 to-purple-50">
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/settings')}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Blocked Users</h1>
            <p className="text-gray-600 mt-1">Manage users you've blocked</p>
          </div>
        </div>

        {/* Content */}
        {blockedUsers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-4xl">🚫</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Blocked Users</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              You haven't blocked anyone yet. Blocked users won't be able to send you messages.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-600 mb-4">
              {blockedUsers.length} {blockedUsers.length === 1 ? 'user' : 'users'} blocked
            </p>

            <div className="space-y-3">
              {blockedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                    {user.username.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{user.username}</p>
                    <p className="text-sm text-gray-600 truncate">{user.email}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Blocked {new Date(user.blocked_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Unblock Button */}
                  <button
                    onClick={() => handleUnblock(user.id, user.username)}
                    disabled={unblocking === user.id}
                    className="px-4 py-2 border-2 border-green-300 text-green-600 rounded-lg font-medium hover:bg-green-50 disabled:opacity-50 flex-shrink-0"
                  >
                    {unblocking === user.id ? 'Unblocking...' : 'Unblock'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 mt-6 border-2 border-purple-100">
          <div className="flex gap-3">
            <span className="text-purple-600 flex-shrink-0">ℹ️</span>
            <div>
              <p className="font-semibold text-gray-900 mb-2">About Blocking</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Blocked users cannot send you messages</li>
                <li>• They won't see when you're online</li>
                <li>• Previous conversations will remain</li>
                <li>• You can unblock users at any time</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlockedUsersPage;