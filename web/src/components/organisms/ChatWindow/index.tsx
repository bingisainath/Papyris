// // src/components/organisms/ChatWindow.tsx

// import React, { useState, useEffect, useRef } from 'react';
// import { MessageBubble, MessageInput } from '../../molecules';
// import { Avatar, Loading } from '../../atoms';
// import {
//   useConversationRoom,
//   useSendMessage,
//   useTypingIndicator,
//   useReadReceipt,
// } from '../../../hooks/useWebSocket';
// import { useSelector } from 'react-redux';
// import type { RootState } from '../../../redux/store';
// import { selectIsConnected } from '../../../redux/slices/websocketSlice';

// import ChatHeader from '../ChatHeader';
// import UserProfileModal from '../UserProfileModal';
// import GroupDetailsModal from '../GroupDetailsModal';

// interface ChatWindowProps {
//   conversationId: string;
//   conversationName: string;
//   conversationAvatar?: string;
//   isGroup?: boolean;
//   isOnline?: boolean;
//   currentUserId: string;
//   onBack?: () => void;
//   memberIds?: string[]; // Array of member user IDs
//   token: string; // Auth token for API calls
// }

// const ChatWindow: React.FC<ChatWindowProps> = ({
//   conversationId,
//   conversationName,
//   conversationAvatar,
//   isGroup = false,
//   isOnline,
//   currentUserId,
//   onBack,
//   memberIds = [],
//   token,
// }) => {
//   const messagesEndRef = useRef<HTMLDivElement>(null);
//   const [inputText, setInputText] = useState('');

//   const isConnected = useSelector(selectIsConnected);
//   const onlineUsers = useSelector((state: RootState) =>
//     state.websocket?.onlineUsers || new Set<string>()
//   );

//   const lastMarkedMessageId = useRef<string>();
//   const hasCleared = useRef(false);

//   // ✅ Modal states
//   const [showUserProfile, setShowUserProfile] = useState(false);
//   const [showGroupDetails, setShowGroupDetails] = useState(false);

//   // ✅ Get other user ID for DM conversations
//   const otherUserId = !isGroup && memberIds.length > 0
//     ? memberIds.find(id => id !== currentUserId) || null
//     : null;

//   // ✅ Create conversation object for ChatHeader
//   const conversation = {
//     id: conversationId,
//     name: conversationName,
//     avatar: conversationAvatar,
//     isGroup,
//     isOnline: isGroup ? false : (otherUserId ? onlineUsers.has(otherUserId) : false),
//     members: memberIds,
//     lastMessage: '',
//     lastMessageTime: '',
//     unreadCount: 0,
//     isPinned: false,
//   };

//   // ✅ Track active conversation globally
//   useEffect(() => {
//     (window as any).__activeConversationId = conversationId;

//     return () => {
//       (window as any).__activeConversationId = null;
//     };
//   }, [conversationId]);

//   // ✅ WebSocket: Auto join/leave conversation room
//   useConversationRoom(conversationId);

//   // ✅ WebSocket: Get messages from Redux (populated by WebSocket)
//   const messages = useSelector((state: RootState) =>
//     state.chat?.messages[conversationId] || []
//   );

//   // ✅ WebSocket: Send message functionality
//   const { sendMessage } = useSendMessage();

//   // ✅ WebSocket: Typing indicators
//   const { isTyping, typingUsers, startTyping, stopTyping } = useTypingIndicator(conversationId);

//   // ✅ WebSocket: Read receipts
//   const { markAsRead } = useReadReceipt(conversationId);

//   // Auto-scroll to bottom when new messages arrive
//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [messages]);

//   // Reset hasCleared when conversation changes
//   useEffect(() => {
//     hasCleared.current = false;
//   }, [conversationId]);

//   // Mark messages as read when viewing
//   useEffect(() => {
//     if (messages.length === 0) return;

//     const lastMessage = messages[messages.length - 1];

//     // Skip if: (1) own message, (2) already marked, (3) temp message
//     if (
//       lastMessage.senderId === currentUserId ||
//       lastMessage.id === lastMarkedMessageId.current ||
//       lastMessage.id.startsWith('temp-')
//     ) {
//       return;
//     }

//     // Mark as read
//     markAsRead(lastMessage.id);
//     lastMarkedMessageId.current = lastMessage.id;
//   }, [messages, currentUserId, markAsRead]);

//   // Handle send message
//   const handleSendMessage = (text: string, file?: File) => {
//     if (!text.trim() && !file) return;

//     // Stop typing indicator
//     stopTyping();

//     // ✅ Send via WebSocket
//     sendMessage(conversationId, text);

//     // Clear input
//     setInputText('');
//   };

//   // Handle typing
//   const handleTyping = (isTyping: boolean) => {
//     if (isTyping) {
//       startTyping();
//     } else {
//       stopTyping();
//     }
//   };

//   if (!isConnected) {
//     return (
//       <div className="flex items-center justify-center h-full">
//         <div className="text-center">
//           <Loading size="lg" />
//           <p className="mt-4 text-muted-600">Connecting...</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="flex flex-col h-full bg-white">
//       {/* ✅ NEW: Use ChatHeader component */}
//       <ChatHeader
//         conversation={conversation}
//         currentUserId={currentUserId}
//         onlineUsers={onlineUsers}
//         onViewProfile={(userId) => setShowUserProfile(true)}
//         onViewGroupDetails={(groupId) => setShowGroupDetails(true)}
//         onBack={onBack}
//       />

//       {/* Messages Area */}
//       <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 pb-20 md:pb-4">
//         {messages.length === 0 ? (
//           <div className="flex items-center justify-center h-full">
//             <p className="text-muted-400">No messages yet. Say hi! 👋</p>
//           </div>
//         ) : (
//           <>
//             {messages.map((message) => (
//               <MessageBubble
//                 key={message.id}
//                 text={message.text}
//                 timestamp={message.timestamp}
//                 isSent={message.senderId === currentUserId}
//                 senderName={message.senderName}
//                 senderAvatar={message.senderAvatar}
//                 status={message.status}
//                 mediaUrl={message.mediaUrl}
//                 mediaType={message.mediaType}
//               />
//             ))}
//             <div ref={messagesEndRef} />
//           </>
//         )}
//       </div>

//       {/* Typing Indicator */}
//       {isTyping && (
//         <div className="px-6 py-2 text-sm text-muted-500">
//           {typingUsers.length === 1 ? 'Someone is' : 'Multiple people are'} typing
//           <span className="inline-flex gap-1 ml-2">
//             <span className="w-2 h-2 bg-muted-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
//             <span className="w-2 h-2 bg-muted-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
//             <span className="w-2 h-2 bg-muted-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
//           </span>
//         </div>
//       )}

//       {/* Message Input */}
//       <div className="border-t border-muted-200 bg-white mobile-safe-bottom md:pb-0">
//         <MessageInput
//           value={inputText}
//           onChange={setInputText}
//           onSend={handleSendMessage}
//           onTyping={handleTyping}
//           placeholder="Type a message..."
//           disabled={!isConnected}
//         />
//       </div>

//       {/* Not connected warning */}
//       {!isConnected && (
//         <div className="px-6 py-2 bg-warning-50 border-t border-warning-200">
//           <p className="text-sm text-warning-700">
//             ⚠️ Not connected. Trying to reconnect...
//           </p>
//         </div>
//       )}

//       {/* ✅ Modals - Only render when appropriate */}
//       {!isGroup && otherUserId && (
//         <UserProfileModal
//           isOpen={showUserProfile}
//           onClose={() => setShowUserProfile(false)}
//           userId={otherUserId}
//           currentUserId={currentUserId}
//           token={token}
//           onStartChat={(conversationId) => {
//             // Already in this chat, just close modal
//             setShowUserProfile(false);
//           }}
//         />
//       )}

//       {isGroup && (
//         <GroupDetailsModal
//           isOpen={showGroupDetails}
//           onClose={() => setShowGroupDetails(false)}
//           groupId={conversationId}
//           currentUserId={currentUserId}
//           token={token}
//           onlineUsers={onlineUsers}
//         />
//       )}
//     </div>
//   );
// };

// export default ChatWindow;


// web/src/components/organisms/ChatWindow/index.tsx
// Full replacement — wires search, profile modal, group details modal into one place

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../redux/store';
import { selectIsConnected } from '../../../redux/slices/websocketSlice';
import {
  useConversationRoom,
  useSendMessage,
  useTypingIndicator,
  useReadReceipt,
} from '../../../hooks/useWebSocket';

import { MessageBubble, MessageInput } from '../../molecules';
import { Loading } from '../../atoms';
import ChatHeader from '../ChatHeader';
import UserProfileModal from '../UserProfileModal';
import GroupDetailsModal from '../GroupDetailsModal';

interface ChatWindowProps {
  conversationId: string;
  conversationName: string;
  conversationAvatar?: string;
  isGroup?: boolean;
  currentUserId: string;
  onBack?: () => void;
  memberIds?: string[];
  token: string;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  conversationId,
  conversationName,
  conversationAvatar,
  isGroup = false,
  currentUserId,
  onBack,
  memberIds = [],
  token,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState('');

  // ── Redux ──────────────────────────────────────────────────────────────
  const isConnected = useSelector(selectIsConnected);
  const onlineUsers: Set<string> = useSelector((state: RootState) =>
    state.websocket?.onlineUsers
      ? new Set<string>(state.websocket.onlineUsers)
      : new Set<string>()
  );
  const allMessages = useSelector((state: RootState) =>
    state.chat?.messages[conversationId] || []
  );

  // ── Modal states ───────────────────────────────────────────────────────
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showGroupDetails, setShowGroupDetails] = useState(false);

  // ── Search state ───────────────────────────────────────────────────────
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered messages when search is active
  const messages = useMemo(() => {
    if (!searchQuery.trim()) return allMessages;
    return allMessages.filter((m: any) =>
      m.text?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allMessages, searchQuery]);

  // ── Misc ───────────────────────────────────────────────────────────────
  const otherUserId = !isGroup && memberIds.length > 0
    ? memberIds.find(id => id !== currentUserId) || null
    : null;

  const conversation = {
    id: conversationId,
    name: conversationName,
    avatar: conversationAvatar,
    isGroup,
    members: memberIds,
    isOnline: !isGroup && otherUserId ? onlineUsers.has(otherUserId) : false,
  };

  const lastMarkedMessageId = useRef<string>();
  const hasCleared = useRef(false);

  // ── WebSocket hooks ────────────────────────────────────────────────────
  useConversationRoom(conversationId);
  const { sendMessage } = useSendMessage();
  const { isTyping, typingUsers, startTyping, stopTyping } = useTypingIndicator(conversationId);
  const { markAsRead } = useReadReceipt(conversationId);

  // Track active conversation globally (for WS routing)
  useEffect(() => {
    (window as any).__activeConversationId = conversationId;
    hasCleared.current = false;
    return () => { (window as any).__activeConversationId = null; };
  }, [conversationId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1] as any;
    if (
      last.senderId === currentUserId ||
      last.id === lastMarkedMessageId.current ||
      last.id?.startsWith('temp-')
    ) return;
    markAsRead(last.id);
    lastMarkedMessageId.current = last.id;
  }, [messages, currentUserId, markAsRead]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleSendMessage = (text: string, file?: File) => {
    if (!text.trim() && !file) return;
    stopTyping();
    if (file) { alert('File upload coming soon!'); return; }
    sendMessage(conversationId, text);
    setInputText('');
  };

  const handleTyping = (typing: boolean) => {
    typing ? startTyping() : stopTyping();
  };

  const handleGroupUpdated = () => {
    // Refresh conversation list if needed — handled by parent via dispatch
    setShowGroupDetails(false);
  };

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loading size="lg" />
          <p className="mt-4 text-gray-500">Connecting…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white relative" style={{ height: '100%', maxHeight: '100dvh' }}>

      {/* Header */}
      <ChatHeader
        conversation={conversation}
        currentUserId={currentUserId}
        onlineUsers={onlineUsers}
        token={token}
        onViewProfile={() => setShowUserProfile(true)}
        onViewGroupDetails={() => setShowGroupDetails(true)}
        onBack={onBack}
        onSearchChange={setSearchQuery}
        searchActive={searchActive}
        onSearchOpen={() => setSearchActive(true)}
        onSearchClose={() => { setSearchActive(false); setSearchQuery(''); }}
      />

      {/* Search result banner */}
      {searchActive && searchQuery && (
        <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-200 flex items-center justify-between text-sm text-yellow-800">
          <span>
            {messages.length} result{messages.length !== 1 ? 's' : ''} for
            <strong className="mx-1">"{searchQuery}"</strong>
          </span>
          <button
            onClick={() => { setSearchQuery(''); setSearchActive(false); }}
            className="text-yellow-600 hover:text-yellow-800 font-medium"
          >
            Clear
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            {searchQuery ? `No messages match "${searchQuery}"` : 'No messages yet. Say hi! 👋'}
          </div>
        ) : (
          <>
            {(messages as any[]).map((message) => (
              <MessageBubble
                key={message.id}
                text={message.text}
                timestamp={message.timestamp}
                isSent={message.senderId === currentUserId}
                senderName={message.senderName}
                senderAvatar={message.senderAvatar}
                status={message.status}
                mediaUrl={message.mediaUrl}
                mediaType={message.mediaType}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Typing indicator */}
      {isTyping && (
        <div className="px-4 py-2 text-sm text-gray-500 flex items-center gap-2">
          <span>{typingUsers.length === 1 ? 'Someone is' : 'Multiple people are'} typing</span>
          <span className="inline-flex gap-1">
            {[0, 150, 300].map(delay => (
              <span
                key={delay}
                className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
        </div>
      )}

      {/* Message input */}
      <div className="border-t border-gray-200 bg-white flex-shrink-0 sticky bottom-0">
        <MessageInput
          value={inputText}
          onChange={setInputText}
          onSend={handleSendMessage}
          onTyping={handleTyping}
          placeholder="Type a message…"
          disabled={!isConnected}
        />
      </div>

      {/* Reconnecting warning */}
      {!isConnected && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 text-sm text-amber-700">
          ⚠️ Not connected — reconnecting…
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}

      {/* DM: User profile modal */}
      {!isGroup && otherUserId && (
        <UserProfileModal
          isOpen={showUserProfile}
          onClose={() => setShowUserProfile(false)}
          userId={otherUserId}
          currentUserId={currentUserId}
          token={token}
          onStartChat={() => setShowUserProfile(false)}
        />
      )}

      {/* Group: Group details modal */}
      {isGroup && (
        <GroupDetailsModal
          isOpen={showGroupDetails}
          onClose={() => setShowGroupDetails(false)}
          groupId={conversationId}
          currentUserId={currentUserId}
          token={token}
          onlineUsers={onlineUsers}
          onGroupUpdated={handleGroupUpdated}
        />
      )}
    </div>
  );
};

export default ChatWindow;