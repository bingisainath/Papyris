// // src/components/organisms/GroupDetailsModal/index.tsx

// import React, { useState, useEffect } from 'react';
// import { chatService } from '../../../services/chat.service';
// import type { GroupDetails, GroupMember } from '../../../types/group.types';

// interface GroupDetailsModalProps {
//   isOpen: boolean;
//   onClose: () => void;
//   groupId: string;
//   currentUserId: string;
//   token: string;
//   onlineUsers: Set<string>;
// }

// const GroupDetailsModal: React.FC<GroupDetailsModalProps> = ({
//   isOpen,
//   onClose,
//   groupId,
//   currentUserId,
//   token,
//   onlineUsers,
// }) => {
//   const [group, setGroup] = useState<GroupDetails | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [actionLoading, setActionLoading] = useState(false);
//   const [showConfirm, setShowConfirm] = useState<{
//     action: string;
//     userId?: string;
//     username?: string;
//   } | null>(null);

//   useEffect(() => {
//     if (isOpen && groupId) {
//       fetchGroupDetails();
//     }
//   }, [isOpen, groupId]);

//   const fetchGroupDetails = async () => {
//     try {
//       setLoading(true);
//       const response = await chatService.getGroupDetails(groupId, token);
//       if (response.success && response.data) {
//         setGroup(response.data);
//       }
//     } catch (error) {
//       console.error('Error fetching group details:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleToggleAdmin = async (member: GroupMember) => {
//     if (!group) return;

//     try {
//       setActionLoading(true);
//       if (member.role === 'admin') {
//         await chatService.removeAdmin(group.id, member.id, token);
//       } else {
//         await chatService.makeAdmin(group.id, member.id, token);
//       }
//       await fetchGroupDetails();
//     } catch (error) {
//       console.error('Error toggling admin:', error);
//       alert('Failed to update member role');
//     } finally {
//       setActionLoading(false);
//       setShowConfirm(null);
//     }
//   };

//   const handleRemoveMember = async (memberId: string) => {
//     if (!group) return;

//     try {
//       setActionLoading(true);
//       await chatService.removeMember(group.id, memberId, token);
//       await fetchGroupDetails();
//     } catch (error) {
//       console.error('Error removing member:', error);
//       alert('Failed to remove member');
//     } finally {
//       setActionLoading(false);
//       setShowConfirm(null);
//     }
//   };

//   const handleLeaveGroup = async () => {
//     if (!group) return;

//     try {
//       setActionLoading(true);
//       await chatService.leaveGroup(group.id, token);
//       onClose();
//       // Optionally: navigate away or refresh conversation list
//     } catch (error: any) {
//       console.error('Error leaving group:', error);
//       alert(error.response?.data?.detail || 'Failed to leave group');
//     } finally {
//       setActionLoading(false);
//       setShowConfirm(null);
//     }
//   };

//   const isAdmin = group?.current_user_role === 'admin';
//   const isCreator = group?.admins[0] === currentUserId;

//   if (!isOpen) return null;

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
//       <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-scale-in">
//         {loading ? (
//           <div className="flex items-center justify-center p-12">
//             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
//           </div>
//         ) : !group ? (
//           <div className="p-12 text-center">
//             <span className="text-6xl mb-4">😕</span>
//             <h2 className="text-xl font-bold text-gray-900 mb-2">Group not found</h2>
//             <button
//               onClick={onClose}
//               className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg"
//             >
//               Close
//             </button>
//           </div>
//         ) : (
//           <>
//             {/* Header with gradient */}
//             <div className="relative">
//               <div className="h-32 bg-gradient-to-br from-purple-600 to-pink-500" />
              
//               {/* Close button */}
//               <button
//                 onClick={onClose}
//                 className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-lg transition-colors"
//               >
//                 <span className="text-white text-xl">×</span>
//               </button>

//               {/* Group Avatar */}
//               <div className="absolute left-1/2 transform -translate-x-1/2 -bottom-12">
//                 <div className="w-24 h-24 rounded-full bg-white shadow-xl flex items-center justify-center text-purple-600 text-3xl font-bold border-4 border-white">
//                   {group.name.charAt(0).toUpperCase()}
//                 </div>
//               </div>
//             </div>

//             {/* Content */}
//             <div className="pt-16 px-6 pb-6 space-y-6 max-h-[calc(90vh-200px)] overflow-y-auto">
//               {/* Name & Stats */}
//               <div className="text-center">
//                 <h2 className="text-2xl font-bold text-gray-900 mb-2">{group.name}</h2>
//                 <p className="text-gray-600 text-sm">
//                   Created {new Date(group.created_at).toLocaleDateString()}
//                 </p>
//               </div>

//               {/* Stats Cards */}
//               <div className="grid grid-cols-2 gap-3">
//                 <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 text-center">
//                   <p className="text-2xl font-bold text-purple-900">{group.member_count}</p>
//                   <p className="text-sm text-purple-700">Members</p>
//                 </div>
//                 <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-4 text-center">
//                   <p className="text-2xl font-bold text-pink-900">{group.admins.length}</p>
//                   <p className="text-sm text-pink-700">Admins</p>
//                 </div>
//               </div>

//               {/* Members List */}
//               <div className="bg-gray-50 rounded-xl p-4">
//                 <div className="flex items-center justify-between mb-4">
//                   <h3 className="font-semibold text-gray-900">
//                     Members ({group.member_count})
//                   </h3>
//                 </div>

//                 <div className="space-y-2 max-h-64 overflow-y-auto">
//                   {group.members.map((member) => (
//                     <div
//                       key={member.id}
//                       className="flex items-center gap-3 p-3 bg-white hover:bg-gray-50 rounded-lg transition-colors"
//                     >
//                       {/* Avatar */}
//                       <div className="relative">
//                         <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
//                           {member.username.charAt(0).toUpperCase()}
//                         </div>
//                         {onlineUsers.has(member.id) && (
//                           <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
//                         )}
//                       </div>

//                       {/* Info */}
//                       <div className="flex-1 min-w-0">
//                         <div className="flex items-center gap-2">
//                           <p className="font-semibold text-gray-900 truncate text-sm">
//                             {member.username}
//                           </p>
//                           {member.role === 'admin' && (
//                             <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
//                               Admin
//                             </span>
//                           )}
//                           {member.id === group.admins[0] && (
//                             <span title="Creator">👑</span>
//                           )}
//                           {member.id === currentUserId && (
//                             <span className="text-xs text-gray-500">(You)</span>
//                           )}
//                         </div>
//                       </div>

//                       {/* Actions (admin only) */}
//                       {isAdmin && member.id !== currentUserId && member.id !== group.admins[0] && (
//                         <div className="flex items-center gap-1">
//                           <button
//                             onClick={() => setShowConfirm({
//                               action: member.role === 'admin' ? 'remove-admin' : 'make-admin',
//                               userId: member.id,
//                               username: member.username
//                             })}
//                             disabled={actionLoading}
//                             className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 text-sm"
//                             title={member.role === 'admin' ? 'Remove admin' : 'Make admin'}
//                           >
//                             {member.role === 'admin' ? '🛡️' : '⚔️'}
//                           </button>
//                           <button
//                             onClick={() => setShowConfirm({
//                               action: 'remove',
//                               userId: member.id,
//                               username: member.username
//                             })}
//                             disabled={actionLoading}
//                             className="p-2 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 text-sm"
//                             title="Remove member"
//                           >
//                             ❌
//                           </button>
//                         </div>
//                       )}
//                     </div>
//                   ))}
//                 </div>
//               </div>

//               {/* Leave Group */}
//               {!isCreator && (
//                 <button
//                   onClick={() => setShowConfirm({ action: 'leave' })}
//                   disabled={actionLoading}
//                   className="w-full px-4 py-3 border-2 border-red-300 text-red-600 rounded-xl font-medium hover:bg-red-50 disabled:opacity-50 transition-all"
//                 >
//                   Leave Group
//                 </button>
//               )}
//             </div>

//             {/* Confirmation Dialog */}
//             {showConfirm && (
//               <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 rounded-2xl">
//                 <div className="bg-white rounded-xl p-6 max-w-sm w-full">
//                   <h3 className="text-lg font-bold text-gray-900 mb-3">
//                     {showConfirm.action === 'leave' && 'Leave Group?'}
//                     {showConfirm.action === 'remove' && `Remove ${showConfirm.username}?`}
//                     {showConfirm.action === 'make-admin' && `Make ${showConfirm.username} admin?`}
//                     {showConfirm.action === 'remove-admin' && `Remove ${showConfirm.username} as admin?`}
//                   </h3>
//                   <p className="text-gray-600 text-sm mb-6">
//                     {showConfirm.action === 'leave' && 'Are you sure you want to leave this group?'}
//                     {showConfirm.action === 'remove' && 'This member will be removed from the group.'}
//                     {showConfirm.action === 'make-admin' && 'This member will be able to manage the group.'}
//                     {showConfirm.action === 'remove-admin' && 'This member will lose admin privileges.'}
//                   </p>
//                   <div className="flex gap-3">
//                     <button
//                       onClick={() => setShowConfirm(null)}
//                       className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
//                     >
//                       Cancel
//                     </button>
//                     <button
//                       onClick={async () => {
//                         if (showConfirm.action === 'leave') {
//                           await handleLeaveGroup();
//                         } else if (showConfirm.action === 'remove' && showConfirm.userId) {
//                           await handleRemoveMember(showConfirm.userId);
//                         } else if ((showConfirm.action === 'make-admin' || showConfirm.action === 'remove-admin') && showConfirm.userId) {
//                           const member = group?.members.find(m => m.id === showConfirm.userId);
//                           if (member) await handleToggleAdmin(member);
//                         }
//                       }}
//                       className={`flex-1 px-4 py-2 rounded-lg text-white ${
//                         showConfirm.action === 'leave' || showConfirm.action === 'remove'
//                           ? 'bg-red-600 hover:bg-red-700'
//                           : 'bg-purple-600 hover:bg-purple-700'
//                       }`}
//                     >
//                       Confirm
//                     </button>
//                   </div>
//                 </div>
//               </div>
//             )}
//           </>
//         )}
//       </div>
//     </div>
//   );
// };

// export default GroupDetailsModal;


// web/src/components/organisms/GroupDetailsModal/index.tsx
// Full replacement — Members, Settings, Edit tabs; add members search; mute toggle; admin controls

import React, { useState, useEffect, useCallback } from 'react';
import { chatService } from '../../../services/chat.service';
import type { GroupDetails, GroupMember } from '../../../types/group.types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

interface GroupDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  currentUserId: string;
  token: string;
  onlineUsers: Set<string>;
  onGroupUpdated?: () => void;
}

type Tab = 'members' | 'settings' | 'edit';

type ConfirmAction = {
  type: 'leave' | 'remove' | 'make-admin' | 'remove-admin';
  userId?: string;
  username?: string;
};

// ── Small helpers ─────────────────────────────────────────────────────────

const Avatar: React.FC<{ name: string; src?: string; size?: number; online?: boolean }> = ({
  name, src, size = 10, online,
}) => (
  <div className="relative flex-shrink-0">
    {src ? (
      <img src={src} alt={name} className={`w-${size} h-${size} rounded-full object-cover`} />
    ) : (
      <div
        className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm`}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    )}
    {online && (
      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
    )}
  </div>
);

const Toggle: React.FC<{ value: boolean; onChange: () => void; disabled?: boolean }> = ({
  value, onChange, disabled,
}) => (
  <button
    onClick={onChange}
    disabled={disabled}
    className={`relative w-12 h-6 rounded-full transition-colors duration-200 disabled:opacity-50 ${value ? 'bg-purple-600' : 'bg-gray-300'}`}
  >
    <span
      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${value ? 'translate-x-7' : 'translate-x-1'}`}
    />
  </button>
);

// ── Main component ─────────────────────────────────────────────────────────

const GroupDetailsModal: React.FC<GroupDetailsModalProps> = ({
  isOpen, onClose, groupId, currentUserId, token, onlineUsers, onGroupUpdated,
}) => {
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('members');
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

  // Mute
  const [muted, setMuted] = useState(false);
  const [muteLoading, setMuteLoading] = useState(false);

  // Add members
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<any[]>([]);
  const [memberSearching, setMemberSearching] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [addLoading, setAddLoading] = useState(false);

  // Edit form
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const isAdmin = group?.current_user_role === 'admin';
  const isCreator = group?.admins[0] === currentUserId;

  // ── Data fetching ─────────────────────────────────────────────────────

  const fetchGroup = useCallback(async () => {
    try {
      setLoading(true);
      const res = await chatService.getGroupDetails(groupId, token);
      if (res.success && res.data) {
        setGroup(res.data);
        setEditName(res.data.name || '');
        setEditDescription('');
        setEditAvatarUrl(res.data.avatar || '');
      }
    } catch (e) {
      console.error('Fetch group error:', e);
    } finally {
      setLoading(false);
    }
  }, [groupId, token]);

  const fetchMuteState = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/conversations/${groupId}/mute`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setMuted(data.data.muted);
    } catch {
      // ignore
    }
  }, [groupId, token]);

  useEffect(() => {
    if (isOpen && groupId) {
      fetchGroup();
      fetchMuteState();
    }
  }, [isOpen, groupId, fetchGroup, fetchMuteState]);

  // ── Mute ─────────────────────────────────────────────────────────────

  const handleToggleMute = async () => {
    try {
      setMuteLoading(true);
      const newMuted = !muted;
      const res = await fetch(`${API_URL}/conversations/${groupId}/mute`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ muted: newMuted }),
      });
      const data = await res.json();
      if (data.success) setMuted(newMuted);
    } catch {
      // ignore
    } finally {
      setMuteLoading(false);
    }
  };

  // ── Member actions ────────────────────────────────────────────────────

  const handleToggleAdmin = async (member: GroupMember) => {
    try {
      setActionLoading(true);
      if (member.role === 'admin') {
        await chatService.removeAdmin(groupId, member.id, token);
      } else {
        await chatService.makeAdmin(groupId, member.id, token);
      }
      await fetchGroup();
    } catch (e) {
      alert('Failed to update admin role');
    } finally {
      setActionLoading(false);
      setConfirm(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      setActionLoading(true);
      await chatService.removeMember(groupId, userId, token);
      await fetchGroup();
      onGroupUpdated?.();
    } catch {
      alert('Failed to remove member');
    } finally {
      setActionLoading(false);
      setConfirm(null);
    }
  };

  const handleLeaveGroup = async () => {
    try {
      setActionLoading(true);
      await chatService.leaveGroup(groupId, token);
      onGroupUpdated?.();
      onClose();
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Failed to leave group');
    } finally {
      setActionLoading(false);
      setConfirm(null);
    }
  };

  // ── Group settings toggle ─────────────────────────────────────────────

  const handleSettingToggle = async (key: string, currentValue: boolean) => {
    try {
      await chatService.updateGroupSettings(groupId, { [key]: !currentValue }, token);
      await fetchGroup();
    } catch {
      alert('Failed to update setting');
    }
  };

  // ── Add members ───────────────────────────────────────────────────────

  const searchUsers = async (q: string) => {
    if (!q.trim()) { setMemberResults([]); return; }
    try {
      setMemberSearching(true);
      const res = await fetch(`${API_URL}/users?search=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        const memberIds = new Set(group?.members.map(m => m.id));
        setMemberResults((data.data || []).filter((u: any) => !memberIds.has(u.id)));
      }
    } catch {
      // ignore
    } finally {
      setMemberSearching(false);
    }
  };

  const handleAddMembers = async () => {
    if (!selectedToAdd.size) return;
    try {
      setAddLoading(true);
      const res = await fetch(`${API_URL}/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_ids: Array.from(selectedToAdd) }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedToAdd(new Set());
        setMemberSearch('');
        setMemberResults([]);
        setShowAddMembers(false);
        await fetchGroup();
        onGroupUpdated?.();
      }
    } catch {
      alert('Failed to add members');
    } finally {
      setAddLoading(false);
    }
  };

  // ── Edit group info ───────────────────────────────────────────────────

  const handleSaveGroupInfo = async () => {
    if (!editName.trim()) return;
    try {
      setEditLoading(true);
      const res = await fetch(`${API_URL}/groups/${groupId}/info`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || undefined,
          avatar_url: editAvatarUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchGroup();
        onGroupUpdated?.();
        setTab('members');
      }
    } catch {
      alert('Failed to update group info');
    } finally {
      setEditLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Group Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center flex-1 py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
          </div>
        ) : !group ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 py-20">Group not found.</div>
        ) : (
          <>
            {/* Hero */}
            <div className="bg-gradient-to-br from-purple-600 to-pink-600 px-6 py-6 text-white text-center">
              <div className="w-16 h-16 rounded-full bg-white/25 flex items-center justify-center text-3xl mx-auto mb-3 overflow-hidden">
                {group.avatar ? (
                  <img src={group.avatar} alt={group.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{group.name?.charAt(0)?.toUpperCase()}</span>
                )}
              </div>
              <h3 className="text-xl font-bold">{group.name}</h3>
              <p className="text-purple-200 text-sm mt-1">
                {group.member_count} members · {group.admins.length} admins
              </p>
              <p className="text-purple-300 text-xs mt-0.5">
                Created {new Date(group.created_at).toLocaleDateString()}
              </p>

              {/* Quick action buttons */}
              <div className="flex justify-center gap-2 mt-4">
                <button
                  onClick={handleToggleMute}
                  disabled={muteLoading}
                  className="px-4 py-1.5 rounded-full text-sm font-medium bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50"
                >
                  {muted ? '🔔 Unmute' : '🔕 Mute'}
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setTab('edit')}
                    className="px-4 py-1.5 rounded-full text-sm font-medium bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    ✏️ Edit Group
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {(['members', 'settings', ...(isAdmin ? ['edit'] : [])] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                    tab === t
                      ? 'text-purple-600 border-b-2 border-purple-600 -mb-px'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t === 'members' ? `Members (${group.member_count})` : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

              {/* ── MEMBERS TAB ────────────────────────────────────── */}
              {tab === 'members' && (
                <>
                  {/* Add members button */}
                  {(isAdmin || !group.settings?.only_admins_can_add_members) && (
                    <button
                      onClick={() => setShowAddMembers(v => !v)}
                      className="w-full py-2.5 border-2 border-dashed border-purple-300 text-purple-600 text-sm font-medium rounded-xl hover:bg-purple-50 transition-colors"
                    >
                      {showAddMembers ? '✕ Cancel' : '+ Add Members'}
                    </button>
                  )}

                  {/* Add members panel */}
                  {showAddMembers && (
                    <div className="bg-purple-50 rounded-xl p-4 space-y-3">
                      <input
                        type="text"
                        placeholder="Search users to add…"
                        value={memberSearch}
                        onChange={e => { setMemberSearch(e.target.value); searchUsers(e.target.value); }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      {memberSearching && <p className="text-xs text-gray-400">Searching…</p>}
                      {memberResults.map(u => (
                        <label key={u.id} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedToAdd.has(u.id)}
                            onChange={e => {
                              const next = new Set(selectedToAdd);
                              e.target.checked ? next.add(u.id) : next.delete(u.id);
                              setSelectedToAdd(next);
                            }}
                            className="accent-purple-600"
                          />
                          <Avatar name={u.username} src={u.avatar} size={8} />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{u.username}</p>
                            <p className="text-xs text-gray-500">{u.email}</p>
                          </div>
                        </label>
                      ))}
                      {selectedToAdd.size > 0 && (
                        <button
                          onClick={handleAddMembers}
                          disabled={addLoading}
                          className="w-full py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                        >
                          {addLoading ? 'Adding…' : `Add ${selectedToAdd.size} Member${selectedToAdd.size > 1 ? 's' : ''}`}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Member list */}
                  {group.members.map(member => (
                    <div key={member.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                      <Avatar
                        name={member.username}
                        src={member.avatar}
                        size={10}
                        online={onlineUsers.has(member.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-sm text-gray-900 truncate">{member.username}</span>
                          {member.role === 'admin' && (
                            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">Admin</span>
                          )}
                          {member.id === group.admins[0] && <span title="Group creator">👑</span>}
                          {member.id === currentUserId && <span className="text-xs text-gray-400">(You)</span>}
                        </div>
                        <p className="text-xs text-gray-400">
                          {onlineUsers.has(member.id) ? '🟢 Online' : '⚫ Offline'}
                        </p>
                      </div>

                      {/* Admin controls (only for other non-creator members) */}
                      {isAdmin && member.id !== currentUserId && member.id !== group.admins[0] && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => setConfirm({
                              type: member.role === 'admin' ? 'remove-admin' : 'make-admin',
                              userId: member.id,
                              username: member.username,
                            })}
                            disabled={actionLoading}
                            title={member.role === 'admin' ? 'Remove admin' : 'Make admin'}
                            className="p-1.5 hover:bg-gray-200 rounded-lg text-sm disabled:opacity-50 transition-colors"
                          >
                            {member.role === 'admin' ? '🛡️' : '⚔️'}
                          </button>
                          <button
                            onClick={() => setConfirm({ type: 'remove', userId: member.id, username: member.username })}
                            disabled={actionLoading}
                            title="Remove member"
                            className="p-1.5 hover:bg-red-100 rounded-lg text-sm disabled:opacity-50 transition-colors"
                          >
                            ❌
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Leave group */}
                  {!isCreator && (
                    <button
                      onClick={() => setConfirm({ type: 'leave' })}
                      className="w-full py-3 mt-2 border-2 border-red-300 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 transition-colors"
                    >
                      Leave Group
                    </button>
                  )}
                </>
              )}

              {/* ── SETTINGS TAB ───────────────────────────────────── */}
              {tab === 'settings' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">Group Permissions</h3>
                  {[
                    { label: 'Only admins can send messages', key: 'only_admins_can_message', value: group.settings?.only_admins_can_message },
                    { label: 'Only admins can add members', key: 'only_admins_can_add_members', value: group.settings?.only_admins_can_add_members },
                    { label: 'Message notifications', key: 'send_message_notification', value: group.settings?.send_message_notification },
                  ].map(s => (
                    <div key={s.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{s.label}</p>
                        <p className="text-xs text-gray-400">{s.value ? 'Enabled' : 'Disabled'}</p>
                      </div>
                      <Toggle
                        value={!!s.value}
                        onChange={() => isAdmin && handleSettingToggle(s.key, !!s.value)}
                        disabled={!isAdmin}
                      />
                    </div>
                  ))}
                  {!isAdmin && (
                    <p className="text-xs text-gray-400 text-center">Only admins can change group settings.</p>
                  )}
                </div>
              )}

              {/* ── EDIT TAB (admin only) ───────────────────────────── */}
              {tab === 'edit' && isAdmin && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Group Name *</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      maxLength={100}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter group name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={editDescription}
                      onChange={e => setEditDescription(e.target.value)}
                      rows={3}
                      maxLength={300}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                      placeholder="Group description (optional)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Avatar URL</label>
                    <input
                      type="url"
                      value={editAvatarUrl}
                      onChange={e => setEditAvatarUrl(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="https://…"
                    />
                    {editAvatarUrl && (
                      <img
                        src={editAvatarUrl}
                        alt="Preview"
                        className="mt-2 w-16 h-16 rounded-full object-cover border border-gray-200"
                        onError={e => ((e.target as HTMLImageElement).style.display = 'none')}
                      />
                    )}
                  </div>
                  <button
                    onClick={handleSaveGroupInfo}
                    disabled={editLoading || !editName.trim()}
                    className="w-full py-3 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {editLoading ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Confirmation dialog */}
        {confirm && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 rounded-2xl z-10">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
              <h3 className="text-base font-bold text-gray-900 mb-2">
                {confirm.type === 'leave' && 'Leave this group?'}
                {confirm.type === 'remove' && `Remove ${confirm.username}?`}
                {confirm.type === 'make-admin' && `Make ${confirm.username} an admin?`}
                {confirm.type === 'remove-admin' && `Remove ${confirm.username} as admin?`}
              </h3>
              <p className="text-sm text-gray-600 mb-5">
                {confirm.type === 'leave' && 'You will lose access to this group and its messages.'}
                {confirm.type === 'remove' && 'This member will be removed from the group.'}
                {confirm.type === 'make-admin' && 'They will be able to manage members and settings.'}
                {confirm.type === 'remove-admin' && 'They will lose admin privileges.'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirm(null)}
                  className="flex-1 py-2 border border-gray-300 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (confirm.type === 'leave') handleLeaveGroup();
                    else if (confirm.type === 'remove' && confirm.userId) handleRemoveMember(confirm.userId);
                    else if ((confirm.type === 'make-admin' || confirm.type === 'remove-admin') && confirm.userId) {
                      const m = group?.members.find(x => x.id === confirm.userId);
                      if (m) handleToggleAdmin(m);
                    }
                  }}
                  disabled={actionLoading}
                  className={`flex-1 py-2 rounded-xl text-sm text-white font-medium disabled:opacity-50 transition-colors ${
                    confirm.type === 'leave' || confirm.type === 'remove'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {actionLoading ? '…' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupDetailsModal;