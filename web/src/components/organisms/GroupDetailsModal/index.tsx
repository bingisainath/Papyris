// src/components/organisms/GroupDetailsModal/index.tsx

import React, { useState, useEffect } from 'react';
import { chatService } from '../../../services/chat.service';
import type { GroupDetails, GroupMember } from '../../../types/group.types';

interface GroupDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  currentUserId: string;
  token: string;
  onlineUsers: Set<string>;
}

const GroupDetailsModal: React.FC<GroupDetailsModalProps> = ({
  isOpen,
  onClose,
  groupId,
  currentUserId,
  token,
  onlineUsers,
}) => {
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{
    action: string;
    userId?: string;
    username?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen && groupId) {
      fetchGroupDetails();
    }
  }, [isOpen, groupId]);

  const fetchGroupDetails = async () => {
    try {
      setLoading(true);
      const response = await chatService.getGroupDetails(groupId, token);
      if (response.success && response.data) {
        setGroup(response.data);
      }
    } catch (error) {
      console.error('Error fetching group details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdmin = async (member: GroupMember) => {
    if (!group) return;

    try {
      setActionLoading(true);
      if (member.role === 'admin') {
        await chatService.removeAdmin(group.id, member.id, token);
      } else {
        await chatService.makeAdmin(group.id, member.id, token);
      }
      await fetchGroupDetails();
    } catch (error) {
      console.error('Error toggling admin:', error);
      alert('Failed to update member role');
    } finally {
      setActionLoading(false);
      setShowConfirm(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!group) return;

    try {
      setActionLoading(true);
      await chatService.removeMember(group.id, memberId, token);
      await fetchGroupDetails();
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member');
    } finally {
      setActionLoading(false);
      setShowConfirm(null);
    }
  };

  const handleLeaveGroup = async () => {
    if (!group) return;

    try {
      setActionLoading(true);
      await chatService.leaveGroup(group.id, token);
      onClose();
      // Optionally: navigate away or refresh conversation list
    } catch (error: any) {
      console.error('Error leaving group:', error);
      alert(error.response?.data?.detail || 'Failed to leave group');
    } finally {
      setActionLoading(false);
      setShowConfirm(null);
    }
  };

  const isAdmin = group?.current_user_role === 'admin';
  const isCreator = group?.admins[0] === currentUserId;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-scale-in">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : !group ? (
          <div className="p-12 text-center">
            <span className="text-6xl mb-4">😕</span>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Group not found</h2>
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

              {/* Group Avatar */}
              <div className="absolute left-1/2 transform -translate-x-1/2 -bottom-12">
                <div className="w-24 h-24 rounded-full bg-white shadow-xl flex items-center justify-center text-purple-600 text-3xl font-bold border-4 border-white">
                  {group.name.charAt(0).toUpperCase()}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="pt-16 px-6 pb-6 space-y-6 max-h-[calc(90vh-200px)] overflow-y-auto">
              {/* Name & Stats */}
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{group.name}</h2>
                <p className="text-gray-600 text-sm">
                  Created {new Date(group.created_at).toLocaleDateString()}
                </p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-purple-900">{group.member_count}</p>
                  <p className="text-sm text-purple-700">Members</p>
                </div>
                <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-pink-900">{group.admins.length}</p>
                  <p className="text-sm text-pink-700">Admins</p>
                </div>
              </div>

              {/* Members List */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">
                    Members ({group.member_count})
                  </h3>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {group.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-3 bg-white hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      {/* Avatar */}
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                          {member.username.charAt(0).toUpperCase()}
                        </div>
                        {onlineUsers.has(member.id) && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 truncate text-sm">
                            {member.username}
                          </p>
                          {member.role === 'admin' && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                              Admin
                            </span>
                          )}
                          {member.id === group.admins[0] && (
                            <span title="Creator">👑</span>
                          )}
                          {member.id === currentUserId && (
                            <span className="text-xs text-gray-500">(You)</span>
                          )}
                        </div>
                      </div>

                      {/* Actions (admin only) */}
                      {isAdmin && member.id !== currentUserId && member.id !== group.admins[0] && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setShowConfirm({
                              action: member.role === 'admin' ? 'remove-admin' : 'make-admin',
                              userId: member.id,
                              username: member.username
                            })}
                            disabled={actionLoading}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 text-sm"
                            title={member.role === 'admin' ? 'Remove admin' : 'Make admin'}
                          >
                            {member.role === 'admin' ? '🛡️' : '⚔️'}
                          </button>
                          <button
                            onClick={() => setShowConfirm({
                              action: 'remove',
                              userId: member.id,
                              username: member.username
                            })}
                            disabled={actionLoading}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 text-sm"
                            title="Remove member"
                          >
                            ❌
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Leave Group */}
              {!isCreator && (
                <button
                  onClick={() => setShowConfirm({ action: 'leave' })}
                  disabled={actionLoading}
                  className="w-full px-4 py-3 border-2 border-red-300 text-red-600 rounded-xl font-medium hover:bg-red-50 disabled:opacity-50 transition-all"
                >
                  Leave Group
                </button>
              )}
            </div>

            {/* Confirmation Dialog */}
            {showConfirm && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 rounded-2xl">
                <div className="bg-white rounded-xl p-6 max-w-sm w-full">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">
                    {showConfirm.action === 'leave' && 'Leave Group?'}
                    {showConfirm.action === 'remove' && `Remove ${showConfirm.username}?`}
                    {showConfirm.action === 'make-admin' && `Make ${showConfirm.username} admin?`}
                    {showConfirm.action === 'remove-admin' && `Remove ${showConfirm.username} as admin?`}
                  </h3>
                  <p className="text-gray-600 text-sm mb-6">
                    {showConfirm.action === 'leave' && 'Are you sure you want to leave this group?'}
                    {showConfirm.action === 'remove' && 'This member will be removed from the group.'}
                    {showConfirm.action === 'make-admin' && 'This member will be able to manage the group.'}
                    {showConfirm.action === 'remove-admin' && 'This member will lose admin privileges.'}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowConfirm(null)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (showConfirm.action === 'leave') {
                          await handleLeaveGroup();
                        } else if (showConfirm.action === 'remove' && showConfirm.userId) {
                          await handleRemoveMember(showConfirm.userId);
                        } else if ((showConfirm.action === 'make-admin' || showConfirm.action === 'remove-admin') && showConfirm.userId) {
                          const member = group?.members.find(m => m.id === showConfirm.userId);
                          if (member) await handleToggleAdmin(member);
                        }
                      }}
                      className={`flex-1 px-4 py-2 rounded-lg text-white ${
                        showConfirm.action === 'leave' || showConfirm.action === 'remove'
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-purple-600 hover:bg-purple-700'
                      }`}
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GroupDetailsModal;