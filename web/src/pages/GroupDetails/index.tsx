// src/pages/GroupDetails/index.tsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { chatService } from '../../services/chat.service';
import type { GroupDetails, GroupMember } from '../../types/group.types';

interface GroupDetailsPageProps {
  currentUserId: string;
  token: string;
}

const GroupDetailsPage: React.FC<GroupDetailsPageProps> = ({ currentUserId, token }) => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (groupId) {
      fetchGroupDetails();
    }
  }, [groupId]);

  const fetchGroupDetails = async () => {
    try {
      setLoading(true);
      const response = await chatService.getGroupDetails(groupId!, token);
      if (response.success && response.data) {
        setGroup(response.data);
      }
    } catch (error) {
      console.error('Error fetching group details:', error);
      alert('Failed to load group details');
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
    }
  };

  const handleRemoveMember = async (memberId: string, username: string) => {
    if (!group) return;
    if (!window.confirm(`Remove ${username} from the group?`)) return;

    try {
      setActionLoading(true);
      await chatService.removeMember(group.id, memberId, token);
      await fetchGroupDetails();
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!group) return;
    if (!window.confirm('Are you sure you want to leave this group?')) return;

    try {
      setActionLoading(true);
      await chatService.leaveGroup(group.id, token);
      navigate('/chat');
    } catch (error: any) {
      console.error('Error leaving group:', error);
      alert(error.response?.data?.detail || 'Failed to leave group');
    } finally {
      setActionLoading(false);
    }
  };

  const isAdmin = group?.current_user_role === 'admin';
  const isCreator = group?.admins[0] === currentUserId;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <span className="text-6xl mb-4">👥</span>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Group not found</h2>
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

          {/* Group Avatar */}
          <div className="relative flex justify-center mt-8 pb-6">
            <div className="w-24 h-24 rounded-full bg-white shadow-xl flex items-center justify-center text-purple-600 text-3xl font-bold">
              {group.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Group Info */}
        <div className="px-6 pb-6 space-y-6">
          {/* Name & Stats */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{group.name}</h1>
            <p className="text-gray-600">
              Created {new Date(group.created_at).toLocaleDateString()}
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{group.member_count}</p>
              <p className="text-sm text-gray-600">Members</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{group.admins.length}</p>
              <p className="text-sm text-gray-600">Admins</p>
            </div>
          </div>

          {/* Members List */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Members ({group.member_count})
              </h2>
            </div>

            <div className="space-y-3">
              {group.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                      {member.username.charAt(0).toUpperCase()}
                    </div>
                    {member.is_online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate">{member.username}</p>
                      {member.role === 'admin' && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                          Admin
                        </span>
                      )}
                      {member.id === group.admins[0] && (
                        <span title="Creator">👑</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate">{member.email}</p>
                  </div>

                  {/* Actions (admin only) */}
                  {isAdmin && member.id !== currentUserId && member.id !== group.admins[0] && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleAdmin(member)}
                        disabled={actionLoading}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                        title={member.role === 'admin' ? 'Remove admin' : 'Make admin'}
                      >
                        {member.role === 'admin' ? '🛡️' : '⚔️'}
                      </button>
                      <button
                        onClick={() => handleRemoveMember(member.id, member.username)}
                        disabled={actionLoading}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
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
            <div className="bg-white rounded-xl shadow-sm p-6">
              <button
                onClick={handleLeaveGroup}
                disabled={actionLoading}
                className="w-full px-4 py-3 border-2 border-red-300 text-red-600 rounded-xl font-medium hover:bg-red-50 disabled:opacity-50"
              >
                {actionLoading ? 'Leaving...' : 'Leave Group'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupDetailsPage;