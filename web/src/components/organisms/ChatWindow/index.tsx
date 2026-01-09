// src/components/organisms/ChatWindow.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Avatar, Button, Typography } from '../../atoms';
import Icon from '../../atoms/Icon';
import { MessageBubble, MessageInput } from '../../molecules';

interface Message {
  id: string;
  text: string;
  timestamp: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  senderColor?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'file';
  reactions?: { emoji: string; count: number }[];
}

interface ChatWindowProps {
  conversationId: string;
  conversationName: string;
  conversationAvatar?: string;
  isGroup?: boolean;
  isOnline?: boolean;
  lastSeen?: string;
  memberCount?: number;
  messages: Message[];
  currentUserId: string;
  isTyping?: boolean;
  typingUsers?: string[]; // For group chats
  onSendMessage: (message: string, file?: File) => void;
  onTyping?: (isTyping: boolean) => void;
  onLoadMore?: () => void;
  onVideoCall?: () => void;
  onVoiceCall?: () => void;
  onViewInfo?: () => void;
  onViewExpenses?: () => void;
  onBack?: () => void; // For mobile
  className?: string;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  conversationId,
  conversationName,
  conversationAvatar,
  isGroup = false,
  isOnline = false,
  lastSeen,
  memberCount,
  messages,
  currentUserId,
  isTyping = false,
  typingUsers = [],
  onSendMessage,
  onTyping,
  onLoadMore,
  onVideoCall,
  onVoiceCall,
  onViewInfo,
  onViewExpenses,
  onBack,
  className = ''
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Show scroll-to-bottom button if not at bottom
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
    setShowScrollButton(!isAtBottom);

    // Load more messages when scrolling to top
    if (container.scrollTop < 100 && onLoadMore) {
      onLoadMore();
    }
  };

  const getTypingText = () => {
    if (!isTyping) return null;
    
    if (isGroup && typingUsers.length > 0) {
      if (typingUsers.length === 1) {
        return `${typingUsers[0]} is typing...`;
      } else if (typingUsers.length === 2) {
        return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
      } else {
        return `${typingUsers.length} people are typing...`;
      }
    }
    
    return 'typing...';
  };

  return (
    <div className={`flex flex-col h-full bg-gradient-to-br from-muted-50 to-primary-50/20 ${className}`}>
      {/* Header */}
      <div className="glass border-b border-muted-200 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left section */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Back button for mobile */}
            {onBack && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="back" size={20} />}
                onClick={onBack}
                className="md:hidden"
              />
            )}

            {/* Avatar and info */}
            <div 
              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={onViewInfo}
            >
              <Avatar
                src={conversationAvatar}
                alt={conversationName}
                size="lg"
                online={!isGroup && isOnline}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {isGroup && <Icon name="users" size={16} className="text-primary-600 flex-shrink-0" />}
                  <Typography variant="body1" weight="semibold" className="text-muted-900 truncate">
                    {conversationName}
                  </Typography>
                </div>
                <Typography variant="caption" className="text-muted-500">
                  {isGroup 
                    ? `${memberCount} members`
                    : isOnline 
                      ? <span className="flex items-center gap-1"><span className="w-2 h-2 bg-success-500 rounded-full" /> Online</span>
                      : lastSeen || 'Offline'
                  }
                </Typography>
              </div>
            </div>
          </div>

          {/* Right section - Actions */}
          <div className="flex items-center gap-2">
            {onViewExpenses && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="dollar" size={20} className="text-accent-600" />}
                onClick={onViewExpenses}
                title="View expenses"
              />
            )}
            {onVideoCall && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="video" size={20} />}
                onClick={onVideoCall}
                title="Video call"
              />
            )}
            {onVoiceCall && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="phone" size={20} />}
                onClick={onVoiceCall}
                title="Voice call"
              />
            )}
            {onViewInfo && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="info" size={20} />}
                onClick={onViewInfo}
                title="Chat info"
              />
            )}
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth"
      >
        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-24 h-24 mb-4 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center">
              <Icon name="message" size={40} className="text-primary-600" />
            </div>
            <Typography variant="h5" weight="semibold" className="text-muted-900 mb-2">
              No messages yet
            </Typography>
            <Typography variant="body2" className="text-muted-500 max-w-sm">
              Start the conversation by sending a message below
            </Typography>
          </div>
        )}

        {/* Messages */}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            {...message}
            isSent={message.senderId === currentUserId}
            isGroup={isGroup}
            onReply={() => console.log('Reply to', message.id)}
            onReact={(emoji) => console.log('React', emoji, 'to', message.id)}
            onDelete={() => console.log('Delete', message.id)}
          />
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-center gap-2 mb-3">
            <Avatar size="sm" />
            <div className="bg-white border-2 border-muted-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-soft">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                  <span className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <span className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
                <Typography variant="caption" className="text-primary-600">
                  {getTypingText()}
                </Typography>
              </div>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <div className="absolute bottom-24 right-8 z-10 animate-scale-in">
          <Button
            variant="primary"
            size="sm"
            icon={<Icon name="forward" size={20} className="rotate-90" />}
            onClick={scrollToBottom}
            className="rounded-full shadow-elevated"
          />
        </div>
      )}

      {/* Message input */}
      <div className="px-4 py-3 bg-white/80 backdrop-blur-sm border-t border-muted-200">
        <MessageInput
          onSend={onSendMessage}
          onTyping={onTyping}
          showExpense={isGroup}
          placeholder={`Message ${conversationName}...`}
        />
      </div>
    </div>
  );
};

export default ChatWindow;