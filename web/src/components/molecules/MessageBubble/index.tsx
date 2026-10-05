// src/components/molecules/MessageBubble.tsx
import React, { useRef, useState } from 'react';
import { Avatar } from '../../atoms';
import Icon from '../../atoms/Icon';
import { formatMessageTime } from '../../../utils/dateFormat';
import { formatFileSize, mediaBoxStyle } from '../../../utils/media';
import type { Reaction, ReplyPreview } from '../../../redux/slices/chatSlice';

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

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
  mediaFilename?: string;
  mediaSize?: number;
  mediaThumbnail?: string;
  mediaWidth?: number;
  mediaHeight?: number;
  uploadProgress?: number; // 0-100 while the attachment uploads
  isGroup?: boolean;
  isDeleted?: boolean;
  editedAt?: string | null;
  replyTo?: ReplyPreview | null;
  reactions?: Reaction[];
  currentUserId?: string;
  onReply?: () => void;
  onReact?: (emoji: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onJumpToMessage?: (messageId: string) => void;
  onOpenImage?: () => void;
  onMediaError?: () => void; // e.g. the signed link expired
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
  mediaFilename,
  mediaSize,
  mediaThumbnail,
  mediaWidth,
  mediaHeight,
  uploadProgress,
  isGroup = false,
  isDeleted = false,
  editedAt,
  replyTo,
  reactions = [],
  currentUserId,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onJumpToMessage,
  onOpenImage,
  onMediaError,
  className = ''
}) => {
  const [showActions, setShowActions] = useState(false);
  const box = mediaBoxStyle(mediaWidth, mediaHeight);
  const lastPointerType = useRef<string>('mouse');

  const statusIcons: Record<MessageStatus, React.ReactElement> = {
    sending: <Icon name="clock" size={14} className="text-white/70 animate-pulse" />,
    sent: <Icon name="check" size={14} className="text-white/70" />,
    delivered: <Icon name="checkDouble" size={14} className="text-white/70" />,
    read: <Icon name="checkDouble" size={14} className="text-secondary-300" />,
    failed: <Icon name="xCircle" size={14} className="text-accent-400" />
  };

  // Pending/failed messages don't exist on the server yet, so they can't be acted on
  const canAct = !isDeleted && !id.startsWith('temp-');
  const hasActions = canAct && !!(onReply || onReact || onEdit || onDelete);

  // Mouse users get the action bar on hover; touch users toggle it with a tap.
  // (Touch also fires emulated mouse events, so filter by pointer type.)
  const handleBubbleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('a, video, button') || lastPointerType.current === 'mouse') return;
    if (hasActions) setShowActions(open => !open);
  };

  return (
    <div
      data-message-id={id}
      className={`
        flex gap-2 mb-3
        ${isSent ? 'flex-row-reverse' : 'flex-row'}
        ${className}
      `}
      onPointerDown={(e) => { lastPointerType.current = e.pointerType; }}
      onPointerEnter={(e) => { lastPointerType.current = e.pointerType; if (e.pointerType === 'mouse' && hasActions) setShowActions(true); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setShowActions(false); }}
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

      <div className={`flex flex-col min-w-0 max-w-[85%] sm:max-w-[75%] ${isSent ? 'items-end' : 'items-start'}`}>
        {/* Sender name for group chats */}
        {!isSent && isGroup && senderName && (
          <span className="mb-1 ml-3 text-xs font-semibold" style={{ color: senderColor }}>
            {senderName}
          </span>
        )}

        {/* Message bubble */}
        <div
          onClick={handleBubbleClick}
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
          {isDeleted ? (
            <p className={`text-sm italic flex items-center gap-1.5 ${isSent ? 'text-white/80' : 'text-muted-500'}`}>
              <Icon name="xCircle" size={14} />
              {isSent ? 'You deleted this message' : 'This message was deleted'}
            </p>
          ) : (
            <>
              {/* Quoted message this one replies to */}
              {replyTo && (
                <button
                  type="button"
                  onClick={() => onJumpToMessage?.(replyTo.id)}
                  className={`block w-full text-left mb-2 px-3 py-1.5 rounded-lg border-l-4 ${
                    isSent ? 'bg-white/15 border-white/60' : 'bg-muted-50 border-primary-500'
                  }`}
                >
                  <span className={`block text-xs font-semibold ${isSent ? 'text-white' : 'text-primary-700'}`}>
                    {replyTo.senderId === currentUserId ? 'You' : replyTo.senderName || 'Message'}
                  </span>
                  <span className={`block text-xs truncate ${replyTo.isDeleted ? 'italic' : ''} ${isSent ? 'text-white/80' : 'text-muted-600'}`}>
                    {replyTo.text}
                  </span>
                </button>
              )}

              {/* Media content */}
              {mediaUrl && (
                <div className={`relative ${text ? 'mb-2' : 'mb-1'}`}>
                  {mediaType === 'image' && (
                    <button
                      type="button"
                      onClick={onOpenImage}
                      className={`block overflow-hidden rounded-lg ${box ? (isSent ? 'bg-white/10' : 'bg-muted-100') : ''}`}
                      style={box}
                      title="View photo"
                    >
                      <img
                        src={mediaUrl}
                        alt={mediaFilename || 'Shared image'}
                        loading="lazy"
                        onError={onMediaError}
                        className={box ? 'w-full h-full object-cover' : 'rounded-lg max-w-full sm:max-w-xs max-h-64 object-cover'}
                      />
                    </button>
                  )}
                  {mediaType === 'video' && (
                    <video
                      src={mediaUrl}
                      poster={mediaThumbnail}
                      controls
                      playsInline
                      // With a poster nothing needs to load until the user presses play
                      preload={mediaThumbnail ? 'none' : 'metadata'}
                      onError={onMediaError}
                      style={box}
                      className={box ? 'rounded-lg bg-black object-contain' : 'rounded-lg max-w-full sm:max-w-xs max-h-64 bg-black'}
                    />
                  )}
                  {mediaType === 'file' && (
                    <a
                      href={mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={mediaFilename}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isSent ? 'bg-white/15 hover:bg-white/25' : 'bg-muted-100 hover:bg-muted-200'}`}
                    >
                      <Icon name="attach" size={20} />
                      <span className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate max-w-[12rem]">{mediaFilename || 'File'}</span>
                        {mediaSize ? <span className="text-[11px] opacity-70">{formatFileSize(mediaSize)}</span> : null}
                      </span>
                    </a>
                  )}

                  {/* Upload progress */}
                  {uploadProgress !== undefined && (
                    <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/20 rounded-b-lg overflow-hidden">
                      <div
                        className="h-full bg-white transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Text content */}
              {text && (
                <p className={`text-sm break-words whitespace-pre-wrap ${isSent ? 'text-white' : 'text-muted-900'}`}>
                  {text}
                </p>
              )}
            </>
          )}

          {/* Timestamp and status */}
          <div className={`flex items-center gap-1 mt-1 ${isSent ? 'justify-end' : 'justify-start'}`}>
            {editedAt && !isDeleted && (
              <span className={`text-[10px] italic ${isSent ? 'text-white/70' : 'text-muted-400'}`}>edited</span>
            )}
            <span className={`text-[10px] ${isSent ? 'text-white/70' : 'text-muted-400'}`}>
              {formatMessageTime(timestamp)}
            </span>
            {isSent && status && !isDeleted && (
              <span className="flex-shrink-0">
                {statusIcons[status]}
              </span>
            )}
          </div>
        </div>

        {/* Reactions */}
        {reactions.length > 0 && !isDeleted && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isSent ? 'justify-end' : 'justify-start'}`}>
            {reactions.map(reaction => {
              const mine = !!currentUserId && reaction.userIds.includes(currentUserId);
              return (
                <button
                  key={reaction.emoji}
                  type="button"
                  onClick={() => onReact?.(reaction.emoji)}
                  title={mine ? 'Remove your reaction' : 'React'}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-xs shadow-sm transition-colors ${
                    mine ? 'bg-primary-50 border-primary-300' : 'bg-white border-muted-200 hover:bg-muted-50'
                  }`}
                >
                  <span>{reaction.emoji}</span>
                  {reaction.userIds.length > 1 && (
                    <span className="text-muted-600 font-medium">{reaction.userIds.length}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Action bar: quick reactions, reply, edit, delete */}
        {showActions && hasActions && (
          <div className="flex flex-wrap items-center gap-0.5 mt-1 px-1 py-0.5 bg-white border border-muted-200 rounded-full shadow-card animate-fade-in">
            {onReact && QUICK_REACTIONS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => { onReact(emoji); setShowActions(false); }}
                className="h-7 w-7 flex items-center justify-center text-base rounded-full hover:bg-muted-100 transition-colors"
                title={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
            {onReply && (
              <button
                type="button"
                onClick={() => { onReply(); setShowActions(false); }}
                className="p-1.5 hover:bg-muted-100 rounded-full transition-colors"
                title="Reply"
              >
                <Icon name="forward" size={16} className="text-muted-500 rotate-180" />
              </button>
            )}
            {isSent && onEdit && (
              <button
                type="button"
                onClick={() => { onEdit(); setShowActions(false); }}
                className="p-1.5 hover:bg-muted-100 rounded-full transition-colors"
                title="Edit"
              >
                <Icon name="edit" size={16} className="text-muted-500" />
              </button>
            )}
            {isSent && onDelete && (
              <button
                type="button"
                onClick={() => { onDelete(); setShowActions(false); }}
                className="p-1.5 hover:bg-accent-50 rounded-full transition-colors"
                title="Delete for everyone"
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
