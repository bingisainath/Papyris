// src/components/molecules/MessageBubble.tsx
import React, { useState } from 'react';
import { Avatar, Typography } from '../../atoms';
import Icon from '../../atoms/Icon';

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

interface MessageBubbleProps {
  id: string;
  text: string;
  timestamp: string;
  isSent: boolean;
  status?: MessageStatus;
  senderName?: string; // For group chats
  senderAvatar?: string; // For group chats
  senderColor?: string; // For group chat user identification
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'file';
  isGroup?: boolean;
  onReply?: () => void;
  onReact?: (emoji: string) => void;
  onDelete?: () => void;
  reactions?: { emoji: string; count: number }[];
  className?: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  id,
  text,
  timestamp,
  isSent,
  status = 'sent',
  senderName,
  senderAvatar,
  senderColor = '#7e22ce',
  mediaUrl,
  mediaType,
  isGroup = false,
  onReply,
  onReact,
  onDelete,
  reactions = [],
  className = ''
}) => {
  const [showActions, setShowActions] = useState(false);

  const statusIcons: Record<MessageStatus, JSX.Element> = {
    sending: <Icon name="clock" size={14} className="text-white/70 animate-pulse" />,
    sent: <Icon name="check" size={14} className="text-white/70" />,
    delivered: <Icon name="checkDouble" size={14} className="text-white/70" />,
    read: <Icon name="checkDouble" size={14} className="text-secondary-300" />,
    failed: <Icon name="xCircle" size={14} className="text-accent-400" />
  };

  return (
    <div
      className={`
        flex gap-2 mb-3
        ${isSent ? 'flex-row-reverse' : 'flex-row'}
        ${className}
      `}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar for received messages in group chats */}
      {!isSent && isGroup && (
        <Avatar
          src={senderAvatar}
          alt={senderName || 'User'}
          size="sm"
          className="mt-auto"
        />
      )}

      <div className={`flex flex-col max-w-[75%] ${isSent ? 'items-end' : 'items-start'}`}>
        {/* Sender name for group chats */}
        {!isSent && isGroup && senderName && (
          <Typography
            variant="caption"
            weight="semibold"
            className="mb-1 ml-3"
            style={{ color: senderColor }}
          >
            {senderName}
          </Typography>
        )}

        {/* Message bubble */}
        <div
          className={`
            relative
            px-4 py-2.5
            rounded-2xl
            ${isSent
              ? 'bg-gradient-to-br from-primary-700 to-primary-600 text-white rounded-br-sm shadow-card'
              : `bg-white border-2 border-muted-100 text-muted-900 rounded-bl-sm shadow-soft ${
                  isGroup ? 'border-l-4' : ''
                }`
            }
            transition-all duration-200
            animate-scale-in
          `}
          style={
            !isSent && isGroup
              ? { borderLeftColor: senderColor }
              : undefined
          }
        >
          {/* Media content */}
          {mediaUrl && (
            <div className="mb-2">
              {mediaType === 'image' && (
                <img
                  src={mediaUrl}
                  alt="Shared media"
                  className="rounded-lg max-w-xs max-h-64 object-cover"
                />
              )}
              {mediaType === 'video' && (
                <video
                  src={mediaUrl}
                  controls
                  className="rounded-lg max-w-xs max-h-64"
                />
              )}
              {mediaType === 'file' && (
                <div className="flex items-center gap-2 px-3 py-2 bg-black/10 rounded-lg">
                  <Icon name="attach" size={20} />
                  <span className="text-sm">File attachment</span>
                </div>
              )}
            </div>
          )}

          {/* Text content */}
          <Typography
            variant="body2"
            className={`break-words whitespace-pre-wrap ${isSent ? 'text-white' : 'text-muted-900'}`}
          >
            {text}
          </Typography>

          {/* Timestamp and status */}
          <div className={`flex items-center gap-1 mt-1 ${isSent ? 'justify-end' : 'justify-start'}`}>
            <span className={`text-[10px] ${isSent ? 'text-white/70' : 'text-muted-400'}`}>
              {timestamp}
            </span>
            {isSent && status && (
              <span className="flex-shrink-0">
                {statusIcons[status]}
              </span>
            )}
          </div>

          {/* Reactions */}
          {reactions.length > 0 && (
            <div className="absolute -bottom-2 right-2 flex gap-1">
              {reactions.map((reaction, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 bg-white border border-muted-200 rounded-full shadow-sm text-xs"
                >
                  <span>{reaction.emoji}</span>
                  <span className="text-muted-600 font-medium">{reaction.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {showActions && (
          <div
            className={`
              flex gap-1 mt-1 px-2
              transition-all duration-200 animate-fade-in
            `}
          >
            {onReply && (
              <button
                onClick={onReply}
                className="p-1.5 hover:bg-muted-100 rounded-lg transition-colors"
                title="Reply"
              >
                <Icon name="forward" size={16} className="text-muted-500 rotate-180" />
              </button>
            )}
            {onReact && (
              <button
                onClick={() => onReact('❤️')}
                className="p-1.5 hover:bg-muted-100 rounded-lg transition-colors"
                title="React"
              >
                <Icon name="emoji" size={16} className="text-muted-500" />
              </button>
            )}
            {isSent && onDelete && (
              <button
                onClick={onDelete}
                className="p-1.5 hover:bg-accent-50 rounded-lg transition-colors"
                title="Delete"
              >
                <Icon name="delete" size={16} className="text-accent-500" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;