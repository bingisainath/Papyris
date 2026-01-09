// src/components/organisms/ChatWindow.tsx - WITH WEBSOCKET INTEGRATION

import React, { useState, useEffect, useRef } from 'react';
import { MessageBubble, MessageInput } from '../../molecules';
import { Avatar, Loading } from '../../atoms';
import { 
  useConversationRoom, 
  useSendMessage, 
  useTypingIndicator,
  useReadReceipt,
  useOnlinePresence 
} from '../../../hooks/useWebSocket';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../redux/store';

interface ChatWindowProps {
  conversationId: string;
  conversationName: string;
  conversationAvatar?: string;
  isGroup?: boolean;
  isOnline?: boolean;
  currentUserId: string;
  onBack?: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  conversationId,
  conversationName,
  conversationAvatar,
  isGroup,
  isOnline,
  currentUserId,
  onBack
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState('');

  // ✅ WebSocket: Auto join/leave conversation room
  useConversationRoom(conversationId);

  // ✅ WebSocket: Get messages from Redux (populated by WebSocket)
  const messages = useSelector((state: RootState) => 
    state.chat?.messages[conversationId] || []
  );

  // ✅ WebSocket: Send message functionality
  const { sendMessage, isConnected } = useSendMessage();

  // ✅ WebSocket: Typing indicators
  const { isTyping, typingUsers, startTyping, stopTyping } = useTypingIndicator(conversationId);

  // ✅ WebSocket: Read receipts
  const { markAsRead } = useReadReceipt(conversationId);

  // ✅ WebSocket: Online presence (for group members)
  const memberIds = ['user1', 'user2']; // Get from conversation data
  const { isOnline: checkOnline } = useOnlinePresence(memberIds);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.senderId !== currentUserId) {
        markAsRead(lastMessage.id);
      }
    }
  }, [messages, currentUserId, markAsRead]);

  // Handle send message
  const handleSendMessage = (text: string, file?: File) => {
    if (!text.trim() && !file) return;

    // Stop typing indicator
    stopTyping();

    // ✅ Send via WebSocket
    sendMessage(conversationId, text);

    // Clear input
    setInputText('');
  };

  // Handle typing
  const handleTyping = (isTyping: boolean) => {
    if (isTyping) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-muted-200 bg-white/80 backdrop-blur-sm">
        {/* Back button (mobile) */}
        {onBack && (
          <button
            onClick={onBack}
            className="md:hidden p-2 hover:bg-muted-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-muted-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Avatar */}
        <Avatar
          src={conversationAvatar}
          name={conversationName}
          size="md"
          online={isOnline}
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-muted-900 truncate">
            {conversationName}
          </h2>
          
          {/* Status */}
          {isTyping ? (
            <p className="text-sm text-primary-600 font-medium">
              Typing...
            </p>
          ) : (
            <p className="text-sm text-muted-500">
              {isOnline ? 'Online' : 'Offline'}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Connection status indicator */}
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success-500' : 'bg-muted-300'}`} 
               title={isConnected ? 'Connected' : 'Disconnected'} 
          />
          
          <button className="p-2 hover:bg-muted-100 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-muted-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-400">No messages yet. Say hi! 👋</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
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

      {/* Typing Indicator */}
      {isTyping && (
        <div className="px-6 py-2 text-sm text-muted-500">
          {typingUsers.length === 1 ? 'Someone is' : 'Multiple people are'} typing
          <span className="inline-flex gap-1 ml-2">
            <span className="w-2 h-2 bg-muted-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2 h-2 bg-muted-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2 h-2 bg-muted-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </span>
        </div>
      )}

      {/* Message Input */}
      <div className="border-t border-muted-200 bg-white">
        <MessageInput
          value={inputText}
          onChange={setInputText}
          onSend={handleSendMessage}
          onTyping={handleTyping}
          placeholder="Type a message..."
          disabled={!isConnected}
        />
      </div>

      {/* Not connected warning */}
      {!isConnected && (
        <div className="px-6 py-2 bg-warning-50 border-t border-warning-200">
          <p className="text-sm text-warning-700">
            ⚠️ Not connected. Trying to reconnect...
          </p>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;