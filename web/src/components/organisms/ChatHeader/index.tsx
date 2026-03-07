// // src/components/organisms/ChatHeader/index.tsx

// import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import type { Conversation } from '../../../types/chat.types';

// interface ChatHeaderProps {
//   conversation: Conversation;
//   currentUserId: string;
//   onlineUsers: Set<string>;
//   onViewProfile?: (userId: string) => void;
//   onViewGroupDetails?: (groupId: string) => void;
//   onBack?: () => void;
// }

// const ChatHeader: React.FC<ChatHeaderProps> = ({
//   conversation,
//   currentUserId,
//   onlineUsers,
//   onViewProfile,
//   onViewGroupDetails,
//   onBack,
// }) => {
//   const navigate = useNavigate();
//   const [showContextMenu, setShowContextMenu] = useState(false);

//   // Get other user ID for DM
//   const otherUserId = conversation.isGroup 
//     ? null 
//     : conversation.members.find(id => id !== currentUserId);

//   const isOnline = otherUserId ? onlineUsers.has(otherUserId) : false;

//   const handleHeaderClick = () => {
//     if (conversation.isGroup) {
//       // Navigate to group details page
//       if (onViewGroupDetails) {
//         onViewGroupDetails(conversation.id);
//       } else {
//         navigate(`/group/${conversation.id}`);
//       }
//     } else {
//       // Navigate to user profile page
//       if (otherUserId) {
//         if (onViewProfile) {
//           onViewProfile(otherUserId);
//         } else {
//           navigate(`/user/${otherUserId}`);
//         }
//       }
//     }
//   };

//   return (
//     <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
//       {/* Back button (mobile) */}
//       {onBack && (
//         <button
//           onClick={onBack}
//           className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
//         >
//           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
//           </svg>
//         </button>
//       )}

//       {/* Avatar + Info (clickable) */}
//       <button
//         onClick={handleHeaderClick}
//         className="flex items-center gap-3 flex-1 min-w-0 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors text-left"
//       >
//         {/* Avatar */}
//         <div className="relative flex-shrink-0">
//           <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
//             {conversation.name.charAt(0).toUpperCase()}
//           </div>
//           {!conversation.isGroup && isOnline && (
//             <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
//           )}
//         </div>

//         {/* Name + Status */}
//         <div className="flex-1 min-w-0">
//           <div className="flex items-center gap-2">
//             <h2 className="font-semibold text-gray-900 truncate">
//               {conversation.name}
//             </h2>
//             {conversation.isGroup && (
//               <span className="text-xs text-gray-500">
//                 ({conversation.members.length})
//               </span>
//             )}
//           </div>
          
//           {/* Status */}
//           {conversation.isGroup ? (
//             <p className="text-xs text-gray-500 truncate">
//               {conversation.members.length} members
//             </p>
//           ) : (
//             <p className={`text-xs ${isOnline ? 'text-green-600' : 'text-gray-500'}`}>
//               {isOnline ? 'Online' : 'Offline'}
//             </p>
//           )}
//         </div>
//       </button>

//       {/* Context Menu Button */}
//       <div className="relative">
//         <button
//           onClick={() => setShowContextMenu(!showContextMenu)}
//           className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
//         >
//           <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
//             <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
//           </svg>
//         </button>

//         {/* Context Menu Dropdown */}
//         {showContextMenu && (
//           <>
//             {/* Backdrop */}
//             <div 
//               className="fixed inset-0 z-10" 
//               onClick={() => setShowContextMenu(false)}
//             />
            
//             {/* Menu */}
//             <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
//               <button
//                 onClick={() => {
//                   handleHeaderClick();
//                   setShowContextMenu(false);
//                 }}
//                 className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
//               >
//                 <span>ℹ️</span>
//                 <span>{conversation.isGroup ? 'Group Details' : 'View Profile'}</span>
//               </button>
              
//               {!conversation.isGroup && (
//                 <button
//                   onClick={() => {
//                     if (otherUserId) {
//                       navigate(`/user/${otherUserId}`);
//                     }
//                     setShowContextMenu(false);
//                   }}
//                   className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
//                 >
//                   <span>👤</span>
//                   <span>View Profile</span>
//                 </button>
//               )}
              
//               <button
//                 onClick={() => {
//                   // TODO: Implement search in conversation
//                   setShowContextMenu(false);
//                 }}
//                 className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
//               >
//                 <span>🔍</span>
//                 <span>Search</span>
//               </button>
              
//               <hr className="my-1 border-gray-200" />
              
//               <button
//                 onClick={() => {
//                   // TODO: Implement mute
//                   setShowContextMenu(false);
//                 }}
//                 className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
//               >
//                 <span>🔕</span>
//                 <span>Mute</span>
//               </button>
//             </div>
//           </>
//         )}
//       </div>
//     </div>
//   );
// };

// export default ChatHeader;


// web/src/components/organisms/ChatHeader/index.tsx
// Full replacement — implements mute, search-in-conversation, profile/group details

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

interface Conversation {
  id: string;
  name: string;
  avatar?: string;
  isGroup: boolean;
  members: string[];
  isOnline?: boolean;
}

interface ChatHeaderProps {
  conversation: Conversation;
  currentUserId: string;
  onlineUsers: Set<string>;
  token: string;
  // Callbacks to open modals in ChatWindow
  onViewProfile: () => void;
  onViewGroupDetails: () => void;
  onBack?: () => void;
  // Search
  onSearchChange: (query: string) => void;
  searchActive: boolean;
  onSearchOpen: () => void;
  onSearchClose: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversation,
  currentUserId,
  onlineUsers,
  token,
  onViewProfile,
  onViewGroupDetails,
  onBack,
  onSearchChange,
  searchActive,
  onSearchOpen,
  onSearchClose,
}) => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [muted, setMuted] = useState(false);
  const [muteLoading, setMuteLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const otherUserId = !conversation.isGroup
    ? conversation.members.find(id => id !== currentUserId)
    : null;

  const isOnline = !conversation.isGroup && otherUserId
    ? onlineUsers.has(otherUserId)
    : false;

  // Load mute state on mount
  useEffect(() => {
    loadMuteState();
  }, [conversation.id]);

  // Focus search input when shown
  useEffect(() => {
    if (searchActive) searchRef.current?.focus();
    if (!searchActive) {
      setSearchQuery('');
      onSearchChange('');
    }
  }, [searchActive]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadMuteState = async () => {
    try {
      const res = await fetch(`${API_URL}/conversations/${conversation.id}/mute`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setMuted(data.data.muted);
    } catch {
      // ignore
    }
  };

  const handleToggleMute = async () => {
    try {
      setMuteLoading(true);
      const newMuted = !muted;
      const res = await fetch(`${API_URL}/conversations/${conversation.id}/mute`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ muted: newMuted }),
      });
      const data = await res.json();
      if (data.success) setMuted(newMuted);
    } catch {
      // ignore
    } finally {
      setMuteLoading(false);
      setShowMenu(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearchChange(e.target.value);
  };

  const handleProfileClick = () => {
    if (conversation.isGroup) {
      onViewGroupDetails();
    } else {
      onViewProfile();
    }
    setShowMenu(false);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white shadow-sm relative z-10">

      {/* Back (mobile) */}
      {onBack && (
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors md:hidden text-gray-500 flex-shrink-0"
          aria-label="Go back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Avatar + Name — click to view profile */}
      <button
        onClick={handleProfileClick}
        className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
      >
        <div className="relative flex-shrink-0">
          {conversation.avatar ? (
            <img
              src={conversation.avatar}
              alt={conversation.name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
              {conversation.isGroup ? '👥' : (conversation.name?.charAt(0)?.toUpperCase() || '?')}
            </div>
          )}

          {/* Online dot for DMs */}
          {!conversation.isGroup && isOnline && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
          )}

          {/* Mute badge */}
          {muted && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-gray-500 rounded-full flex items-center justify-center text-white text-xs">
              🔕
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate leading-tight">
            {conversation.name}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {conversation.isGroup
              ? `${conversation.members.length} members`
              : isOnline
              ? '🟢 Online'
              : '⚫ Offline'}
          </p>
        </div>
      </button>

      {/* Search bar (when active) */}
      {searchActive && (
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search messages…"
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={onSearchClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="Close search"
          >
            ✕
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">

        {/* Search toggle */}
        {!searchActive && (
          <button
            onClick={onSearchOpen}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
            title="Search in conversation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        )}

        {/* Three-dot menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(v => !v)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
            aria-label="More options"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50">

                {/* View profile / group details */}
                <button
                  onClick={handleProfileClick}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                >
                  <span className="text-base">{conversation.isGroup ? '👥' : '👤'}</span>
                  <span>{conversation.isGroup ? 'Group Details' : 'View Profile'}</span>
                </button>

                {/* Full profile page (DM only) */}
                {!conversation.isGroup && otherUserId && (
                  <button
                    onClick={() => { navigate(`/user/${otherUserId}`); setShowMenu(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <span className="text-base">🔗</span>
                    <span>Open Full Profile</span>
                  </button>
                )}

                {/* Search */}
                <button
                  onClick={() => { onSearchOpen(); setShowMenu(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                >
                  <span className="text-base">🔍</span>
                  <span>Search in Conversation</span>
                </button>

                <hr className="my-1 border-gray-100" />

                {/* Mute */}
                <button
                  onClick={handleToggleMute}
                  disabled={muteLoading}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 disabled:opacity-50"
                >
                  <span className="text-base">{muted ? '🔔' : '🔕'}</span>
                  <span>{muted ? 'Unmute Notifications' : 'Mute Notifications'}</span>
                </button>

              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;