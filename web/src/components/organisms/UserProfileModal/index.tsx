// // src/components/organisms/UserProfileModal/index.tsx

// import React, { useState, useEffect } from 'react';
// import { userService } from '../../../services/user.service';
// import { chatService } from '../../../services/chat.service';
// import { useBlockUser } from '../../../hooks/useBlockUser';
// import type { User } from '../../../types/user.types';

// interface UserProfileModalProps {
//   isOpen: boolean;
//   onClose: () => void;
//   userId: string;
//   currentUserId: string;
//   token: string;
//   onStartChat?: (conversationId: string) => void;
// }

// const UserProfileModal: React.FC<UserProfileModalProps> = ({
//   isOpen,
//   onClose,
//   userId,
//   currentUserId,
//   token,
//   onStartChat,
// }) => {
//   const [user, setUser] = useState<User | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [startingChat, setStartingChat] = useState(false);
  
//   const { isBlocked, blocking, blockUser, unblockUser } = useBlockUser(userId, token);

//   useEffect(() => {
//     if (isOpen && userId) {
//       fetchUserProfile();
//     }
//   }, [isOpen, userId]);

//   const fetchUserProfile = async () => {
//     try {
//       setLoading(true);
//       const response = await userService.getUserProfile(userId, token);
//       if (response.success && response.data) {
//         setUser(response.data);
//       }
//     } catch (error) {
//       console.error('Error fetching user profile:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleStartChat = async () => {
//     if (!user) return;
    
//     try {
//       setStartingChat(true);
//       const response = await chatService.createConversation('dm', [user.id], token);
//       if (response.success && response.data) {
//         if (onStartChat) {
//           onStartChat(response.data.id);
//         }
//         onClose();
//       }
//     } catch (error) {
//       console.error('Error starting chat:', error);
//       alert('Failed to start conversation');
//     } finally {
//       setStartingChat(false);
//     }
//   };

//   const handleBlockToggle = async () => {
//     try {
//       if (isBlocked) {
//         await unblockUser();
//       } else {
//         if (window.confirm(`Block ${user?.username}? They won't be able to message you.`)) {
//           await blockUser();
//         }
//       }
//     } catch (error) {
//       alert('Failed to update block status');
//     }
//   };

//   if (!isOpen) return null;

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
//       <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden animate-scale-in">
//         {loading ? (
//           <div className="flex items-center justify-center p-12">
//             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
//           </div>
//         ) : !user ? (
//           <div className="p-12 text-center">
//             <span className="text-6xl mb-4">😕</span>
//             <h2 className="text-xl font-bold text-gray-900 mb-2">User not found</h2>
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

//               {/* Avatar */}
//               <div className="absolute left-1/2 transform -translate-x-1/2 -bottom-12">
//                 <div className="relative">
//                   <div className="w-24 h-24 rounded-full bg-white shadow-xl flex items-center justify-center text-purple-600 text-3xl font-bold border-4 border-white">
//                     {user.username.charAt(0).toUpperCase()}
//                   </div>
//                   {user.is_online && (
//                     <div className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 border-4 border-white rounded-full"></div>
//                   )}
//                 </div>
//               </div>
//             </div>

//             {/* Content */}
//             <div className="pt-16 px-6 pb-6 space-y-6">
//               {/* Name & Status */}
//               <div className="text-center">
//                 <h2 className="text-2xl font-bold text-gray-900 mb-1">
//                   {user.username}
//                 </h2>
//                 <p className="text-gray-600 text-sm">{user.email}</p>
//                 {user.is_online ? (
//                   <p className="text-green-600 text-sm mt-2 flex items-center justify-center gap-1">
//                     <span className="w-2 h-2 bg-green-500 rounded-full"></span>
//                     Online
//                   </p>
//                 ) : user.last_seen ? (
//                   <p className="text-gray-500 text-sm mt-2">
//                     Last seen {new Date(user.last_seen).toLocaleString()}
//                   </p>
//                 ) : null}
//               </div>

//               {/* Bio */}
//               {user.bio && (
//                 <div className="bg-gray-50 rounded-xl p-4">
//                   <h3 className="text-sm font-semibold text-gray-700 mb-2">About</h3>
//                   <p className="text-gray-600 text-sm">{user.bio}</p>
//                 </div>
//               )}

//               {/* Actions */}
//               <div className="space-y-3">
//                 <button
//                   onClick={handleStartChat}
//                   disabled={isBlocked || startingChat}
//                   className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
//                 >
//                   {startingChat ? 'Starting...' : isBlocked ? 'User Blocked' : '💬 Send Message'}
//                 </button>

//                 <button
//                   onClick={handleBlockToggle}
//                   disabled={blocking}
//                   className={`
//                     w-full px-4 py-3 rounded-xl font-medium transition-all
//                     ${
//                       isBlocked
//                         ? 'border-2 border-green-300 text-green-600 hover:bg-green-50'
//                         : 'border-2 border-red-300 text-red-600 hover:bg-red-50'
//                     }
//                     disabled:opacity-50
//                   `}
//                 >
//                   {blocking ? 'Processing...' : isBlocked ? '✓ Unblock User' : '🚫 Block User'}
//                 </button>
//               </div>

//               {/* Info */}
//               <div className="bg-gray-50 rounded-xl p-4">
//                 <div className="flex items-center justify-between text-sm">
//                   <span className="text-gray-600">Member since</span>
//                   <span className="text-gray-900 font-semibold">
//                     {new Date(user.created_at).toLocaleDateString()}
//                   </span>
//                 </div>
//               </div>

//               {/* Blocked Info */}
//               {isBlocked && (
//                 <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
//                   <div className="flex gap-2">
//                     <span className="text-red-600">⚠️</span>
//                     <div className="text-sm">
//                       <p className="font-semibold text-red-900 mb-1">User is blocked</p>
//                       <p className="text-red-700">
//                         You won't receive messages from this user. Unblock to start chatting again.
//                       </p>
//                     </div>
//                   </div>
//                 </div>
//               )}
//             </div>
//           </>
//         )}
//       </div>
//     </div>
//   );
// };

// export default UserProfileModal;


// web/src/components/organisms/UserProfileModal/index.tsx
// Full replacement — DM profile modal with online status, member since, block/unblock, message count

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../../../services/user.service';
import { chatService } from '../../../services/chat.service';
import { useBlockUser } from '../../../hooks/useBlockUser';
import type { User } from '../../../types/user.types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentUserId: string;
  token: string;
  onStartChat?: (conversationId: string) => void;
  // Optional: pass the conversation ID to show shared message count
  conversationId?: string;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  userId,
  currentUserId,
  token,
  onStartChat,
  conversationId,
}) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState(false);
  const [messageCount, setMessageCount] = useState<number | null>(null);

  const { isBlocked, blocking, blockUser, unblockUser } = useBlockUser(userId, token);

  useEffect(() => {
    if (isOpen && userId) {
      fetchProfile();
    }
  }, [isOpen, userId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await userService.getUserProfile(userId, token);
      if (res.success && res.data) {
        setUser(res.data);
      }

      // Fetch shared message count if we have a conversation
      if (conversationId) {
        try {
          const r = await fetch(`${API_URL}/conversations/${conversationId}/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await r.json();
          if (data.success && data.data?.conversation?.message_count !== undefined) {
            setMessageCount(data.data.conversation.message_count);
          }
        } catch {
          // not critical
        }
      }
    } catch (e) {
      console.error('Profile fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async () => {
    if (!user) return;
    try {
      setStartingChat(true);
      const res = await chatService.createConversation('dm', [user.id], token);
      if (res.success && res.data) {
        onStartChat?.(res.data.id);
        onClose();
      }
    } catch {
      alert('Failed to start conversation');
    } finally {
      setStartingChat(false);
    }
  };

  const handleBlockToggle = async () => {
    if (isBlocked) {
      await unblockUser();
    } else {
      if (window.confirm(`Block ${user?.username}? They won't be able to message you.`)) {
        await blockUser();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-hidden">

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
          </div>
        ) : !user ? (
          <div className="p-10 text-center">
            <span className="text-5xl mb-4 block">😕</span>
            <h2 className="text-lg font-bold text-gray-900 mb-4">User not found</h2>
            <button onClick={onClose} className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg text-sm">Close</button>
          </div>
        ) : (
          <>
            {/* Hero */}
            <div className="relative">
              <div className="h-28 bg-gradient-to-br from-purple-600 to-pink-500" />

              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-2 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Avatar */}
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-10">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-white shadow-xl bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                    ) : (
                      user.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  {user.is_online && (
                    <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-3 border-white rounded-full" />
                  )}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="pt-14 px-6 pb-6 space-y-4">

              {/* Name & status */}
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900">{user.username}</h2>
                <p className="text-gray-500 text-sm">{user.email}</p>
                {user.is_online ? (
                  <p className="text-green-600 text-sm mt-1 flex items-center justify-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
                    Online now
                  </p>
                ) : user.last_seen ? (
                  <p className="text-gray-400 text-sm mt-1">
                    Last seen {new Date(user.last_seen).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-gray-400 text-sm mt-1">⚫ Offline</p>
                )}
              </div>

              {/* Bio */}
              {user.bio && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-sm font-medium text-gray-600 mb-1">About</p>
                  <p className="text-gray-800 text-sm">{user.bio}</p>
                </div>
              )}

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <p className="text-sm text-purple-600 font-medium">Member since</p>
                  <p className="text-gray-900 text-sm font-semibold mt-0.5">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                  </p>
                </div>
                {messageCount !== null && (
                  <div className="bg-pink-50 rounded-xl p-3 text-center">
                    <p className="text-sm text-pink-600 font-medium">Messages</p>
                    <p className="text-gray-900 text-sm font-semibold mt-0.5">{messageCount.toLocaleString()}</p>
                  </div>
                )}
              </div>

              {/* Blocked warning */}
              {isBlocked && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                  ⚠️ You've blocked this user. They can't message you.
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={handleStartChat}
                  disabled={isBlocked || startingChat || userId === currentUserId}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-semibold rounded-xl shadow hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {startingChat ? 'Opening…' : isBlocked ? 'User Blocked' : '💬 Send Message'}
                </button>

                {/* Open full profile page */}
                <button
                  onClick={() => { navigate(`/user/${userId}`); onClose(); }}
                  className="w-full py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  👤 View Full Profile
                </button>

                {userId !== currentUserId && (
                  <button
                    onClick={handleBlockToggle}
                    disabled={blocking}
                    className={`w-full py-2.5 border-2 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${
                      isBlocked
                        ? 'border-green-300 text-green-600 hover:bg-green-50'
                        : 'border-red-300 text-red-600 hover:bg-red-50'
                    }`}
                  >
                    {blocking ? '…' : isBlocked ? '✓ Unblock User' : '🚫 Block User'}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UserProfileModal;