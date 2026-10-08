// src/components/organisms/ChatWindow.tsx

import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { MessageBubble, MessageInput } from '../../molecules';
import { Avatar } from '../../atoms';
import {
  useConversationRoom,
  useSendMessage,
  useTypingIndicator,
  useReadReceipt,
} from '../../../hooks/useWebSocket';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../redux/store';
import { selectIsConnected, selectTypingNames } from '../../../redux/slices/websocketSlice';
import { fetchMessages, fetchOlderMessages } from '../../../redux/actions/chatActions';
import { downloadMedia, messagePreview, resolveMediaUrl } from '../../../utils/media';
import { applyMessageUpdate, clearUnreadCount } from '../../../redux/slices/chatSlice';
import type { Message, ReplyPreview } from '../../../redux/slices/chatSlice';
import { chatService } from '../../../services/chat.service';
import { parseApiError } from '../../../utils/apiError';
import { toast } from 'react-toastify';
import ConversationInfoPanel from '../ConversationInfoPanel';
import MediaViewer from '../MediaViewer';
import type { ViewerImage } from '../MediaViewer';
import { useSearchParams } from 'react-router-dom';
import { Lock, LockOpen, UserPlus } from 'lucide-react';
import { downloadDecrypted } from '../../../crypto/media';
import { sealFor } from '../../../crypto/messages';
import { useChatEncryption } from '../../../crypto/useChatEncryption';
import { mediaPayloadOf } from '../../../redux/actions/websocketActions';
import AddExpenseSheet from '../../expenses/AddExpenseSheet';
import ExpenseCard from '../../expenses/ExpenseCard';
import ExpenseDetail from '../../expenses/ExpenseDetail';
import ForwardDialog from '../ForwardDialog';
import AlbumGrid, { groupAlbums } from '../../molecules/AlbumGrid';
import type { OutgoingAttachment } from '../../molecules/MessageInput';
import { cancelUpload, forwardMessage, retryUpload } from '../../../redux/actions/websocketActions';

// Stable empty value for selectors: returning a new [] each time makes components re-render
const EMPTY: never[] = [];

interface ChatWindowProps {
  conversationId: string;
  conversationName: string;
  conversationAvatar?: string;
  isGroup?: boolean;
  memberCount?: number;
  isOnline?: boolean;
  currentUserId: string;
  onBack?: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  conversationId,
  conversationName,
  conversationAvatar,
  isGroup,
  memberCount,
  isOnline,
  currentUserId,
  onBack
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const encryption = useChatEncryption(conversationId);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastRenderedMessageId = useRef<string | undefined>(undefined);
  const scrollHeightBeforePrepend = useRef<number | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplyPreview | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [infoAddMembers, setInfoAddMembers] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [forwarding, setForwarding] = useState<Message | null>(null);
  const lastMediaRefresh = useRef(0);

  // Expenses: ?receipt=<id> opens a receipt to review, ?expense=<id> opens an expense
  const [searchParams, setSearchParams] = useSearchParams();
  const [addingExpense, setAddingExpense] = useState(false);
  const openReceiptId = searchParams.get('receipt');
  const openExpenseId = searchParams.get('expense');
  const closeExpenseView = () => setSearchParams({}, { replace: true });

  const isConnected = useSelector(selectIsConnected);
  // const onlineUsers = useSelector(selectOnlineUsers);

  const lastMarkedMessageId = useRef<string | undefined>(undefined);

  // ✅ Track active conversation globally
  useEffect(() => {
    (window as any).__activeConversationId = conversationId;

    return () => {
      (window as any).__activeConversationId = null;
    };
  }, [conversationId]);

  // ✅ WebSocket: Auto join/leave conversation room
  useConversationRoom(conversationId);

  // ✅ WebSocket: Get messages from Redux (populated by WebSocket)
  const messages = useSelector((state: RootState) =>
    state.chat?.messages[conversationId] ?? EMPTY
  );
  const hasMoreMessages = useSelector((state: RootState) =>
    state.chat?.hasMoreMessages?.[conversationId] || false
  );

  // ✅ WebSocket: Send message functionality
  const { sendMessage } = useSendMessage();

  // ✅ WebSocket: Typing indicators
  const { isTyping, typingUsers, startTyping, stopTyping } = useTypingIndicator(conversationId);

  const typingNames = useSelector(selectTypingNames);
  const typingText = !isGroup
    ? `${conversationName} is typing`
    : typingUsers.length > 1
      ? `${typingUsers.length} people are typing`
      : `${typingNames[typingUsers[0]] || 'Someone'} is typing`;

  // ✅ WebSocket: Read receipts
  const { markAsRead } = useReadReceipt(conversationId);
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;

    // Older messages were prepended: keep the same messages in view
    if (container && scrollHeightBeforePrepend.current !== null) {
      container.scrollTop = container.scrollHeight - scrollHeightBeforePrepend.current;
      scrollHeightBeforePrepend.current = null;
      return;
    }

    // Scroll to bottom only when a new message arrives at the end
    const lastId = messages[messages.length - 1]?.id;
    if (lastId !== lastRenderedMessageId.current) {
      // Scroll only the message list (scrollIntoView would also scroll clipped ancestors sideways)
      container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
    lastRenderedMessageId.current = lastId;
  }, [messages]);

  // Reset per-conversation state
  useEffect(() => {
    lastMarkedMessageId.current = undefined;
    lastRenderedMessageId.current = undefined;
    setReplyingTo(null);
    setEditingMessage(null);
    setShowInfo(false);
    setAddingExpense(false);
  }, [conversationId]);

  // Send a read receipt for the newest message from others while the chat is visible
  useEffect(() => {
    const latestFromOthers = [...messages]
      .reverse()
      .find(m => m.senderId !== currentUserId && !m.id.startsWith('temp-'));

    if (!latestFromOthers || !isConnected) return;

    const markIfVisible = () => {
      if (
        document.visibilityState !== 'visible' ||
        lastMarkedMessageId.current === latestFromOthers.id
      ) {
        return;
      }
      lastMarkedMessageId.current = latestFromOthers.id;
      markAsRead(latestFromOthers.id);
      dispatch(clearUnreadCount(conversationId));
    };

    markIfVisible();
    document.addEventListener('visibilitychange', markIfVisible);
    return () => document.removeEventListener('visibilitychange', markIfVisible);
  }, [messages, currentUserId, markAsRead, isConnected, conversationId, dispatch]);

  const handleLoadOlder = async () => {
    if (loadingOlder) return;
    setLoadingOlder(true);
    scrollHeightBeforePrepend.current = scrollContainerRef.current?.scrollHeight ?? null;
    try {
      await dispatch(fetchOlderMessages(conversationId));
    } finally {
      setLoadingOlder(false);
      // If nothing was prepended, don't let the saved height affect the next update
      requestAnimationFrame(() => { scrollHeightBeforePrepend.current = null; });
    }
  };

  // Handle send message (or save an edit)
  const handleSendMessage = async (text: string, attachments?: OutgoingAttachment[]) => {
    if (editingMessage) {
      const original = editingMessage;
      setEditingMessage(null);
      if (text === original.text) return;
      if (!text && !original.mediaUrl) {
        toast.error("Message can't be empty. Delete it instead.");
        return;
      }
      try {
        // Encrypted chat: the edit is a new envelope (keeping the attached file's key)
        const sealed = await sealFor(conversationId, { t: text, m: mediaPayloadOf(original) });
        const result = await chatService.editMessage(original.id, sealed?.text ?? text, sealed?.hasLink);
        dispatch(applyMessageUpdate({
          conversationId,
          messageId: original.id,
          text,
          editedAt: result.data?.editedAt ?? new Date().toISOString(),
        }));
      } catch (error) {
        toast.error(`Couldn't edit message: ${parseApiError(error)}`);
      }
      return;
    }

    if (!text.trim() && !attachments?.length) return;

    // Stop typing indicator
    stopTyping();

    if (attachments?.length) {
      // One message per photo/file, each with its own caption (the reply goes on the first)
      attachments.forEach((a, i) => {
        sendMessage(conversationId, a.caption, a.file, i === 0 ? replyingTo : null, { quality: a.quality });
      });
    } else {
      sendMessage(conversationId, text, undefined, replyingTo);
    }
    setReplyingTo(null);
  };

  const handleSendVoice = (file: File, seconds: number) => {
    stopTyping();
    sendMessage(conversationId, '', file, replyingTo, { quality: 'original', duration: seconds });
    setReplyingTo(null);
  };

  const handleDownload = (message: Message) => {
    if (!message.mediaUrl) return;
    (message.mediaKey
      ? downloadDecrypted(message.mediaUrl, message.mediaKey, message.mediaMime, message.mediaFilename || 'download')
      : downloadMedia(message.mediaUrl, message.mediaFilename || 'download'))
      .catch(() => toast.error("Couldn't download it. Try again"));
  };

  const handleReply = (message: Message) => {
    setEditingMessage(null);
    setReplyingTo({
      id: message.id,
      text: messagePreview(message.text, message.mediaType, message.mediaFilename),
      senderId: message.senderId,
      senderName: message.senderId === currentUserId ? 'yourself' : message.senderName,
      messageType: message.messageType,
    });
  };

  const handleEdit = (message: Message) => {
    setReplyingTo(null);
    setEditingMessage(message);
  };

  const handleReact = async (message: Message, emoji: string) => {
    try {
      await chatService.reactToMessage(message.id, emoji);
    } catch (error) {
      toast.error(`Couldn't react: ${parseApiError(error)}`);
    }
  };

  const handleDelete = async (message: Message) => {
    if (!window.confirm('Delete this message for everyone?')) return;
    try {
      await chatService.deleteMessage(message.id);
      dispatch(applyMessageUpdate({ conversationId, messageId: message.id, isDeleted: true }));
      if (editingMessage?.id === message.id) setEditingMessage(null);
    } catch (error) {
      toast.error(`Couldn't delete message: ${parseApiError(error)}`);
    }
  };

  // Single messages and photo albums, in display order
  const chatItems = useMemo(() => groupAlbums(messages), [messages]);

  // Photos in this chat, for the full-screen viewer
  const viewerImages: ViewerImage[] = useMemo(
    () => messages
      .filter(m => m.mediaType === 'image' && m.mediaUrl && !m.isDeleted)
      .map(m => ({
        id: m.id,
        url: resolveMediaUrl(m.mediaUrl)!,
        mediaKey: m.mediaKey,
        mediaMime: m.mediaMime,
        filename: m.mediaFilename,
        senderName: m.senderId === currentUserId ? 'You' : m.senderName,
        timestamp: m.timestamp,
      })),
    [messages, currentUserId]
  );

  const openImage = (messageId: string) => {
    const index = viewerImages.findIndex(image => image.id === messageId);
    if (index !== -1) setViewerIndex(index);
  };

  // Media links are signed and expire after a day or two: reload the messages for fresh links
  const refreshExpiredMedia = useCallback(() => {
    if (Date.now() - lastMediaRefresh.current < 60_000) return;
    lastMediaRefresh.current = Date.now();
    dispatch(fetchMessages(conversationId));
  }, [dispatch, conversationId]);

  // Scroll to (and briefly highlight) the message a reply quotes
  const jumpToMessage = (messageId: string) => {
    const container = scrollContainerRef.current;
    const target = container?.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
    if (!container || !target) {
      toast.info('Load older messages to see the original.');
      return;
    }
    const offset = target.getBoundingClientRect().top - container.getBoundingClientRect().top;
    container.scrollTo({ top: container.scrollTop + offset - container.clientHeight / 3, behavior: 'smooth' });
    target.classList.add('message-highlight');
    window.setTimeout(() => target.classList.remove('message-highlight'), 1600);
  };

  // Handle typing
  const handleTyping = (isTyping: boolean) => {
    if (isTyping) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  const renderMessage = (message: Message) => message.messageType === 'system' && message.expenseId ? (
              <div key={message.id} data-message-id={message.id}>
                <ExpenseCard
                  expenseId={message.expenseId}
                  text={message.text}
                  timestamp={message.timestamp}
                  currentUserId={currentUserId}
                  onOpen={(id) => setSearchParams({ expense: id })}
                />
              </div>
            ) : message.messageType === 'system' ? (
              <div key={message.id} data-message-id={message.id} className="flex justify-center">
                <span className="px-3 py-1 text-xs text-muted-600 bg-muted-100 rounded-full text-center">
                  {message.text}
                </span>
              </div>
            ) : (
              <MessageBubble
                key={message.id}
                id={message.id}
                text={message.text}
                timestamp={message.timestamp}
                isSent={message.senderId === currentUserId}
                senderName={message.senderName}
                senderAvatar={message.senderAvatar}
                status={message.status}
                mediaUrl={resolveMediaUrl(message.mediaUrl)}
                mediaType={message.mediaType}
                mediaFilename={message.mediaFilename}
                mediaSize={message.mediaSize}
                mediaThumbnail={resolveMediaUrl(message.mediaThumbnail)}
                mediaWidth={message.mediaWidth}
                mediaHeight={message.mediaHeight}
                mediaKey={message.mediaKey}
                mediaMime={message.mediaMime}
                thumbKey={message.thumbKey}
                e2e={message.e2e}
                e2eUnverified={message.e2eUnverified}
                uploadProgress={message.uploadProgress}
                isGroup={isGroup}
                isDeleted={message.isDeleted}
                editedAt={message.editedAt}
                replyTo={message.replyTo}
                reactions={message.reactions}
                currentUserId={currentUserId}
                onReply={() => handleReply(message)}
                onReact={(emoji) => handleReact(message, emoji)}
                onEdit={() => handleEdit(message)}
                onDelete={() => handleDelete(message)}
                onJumpToMessage={jumpToMessage}
                onOpenImage={() => openImage(message.id)}
                onMediaError={message.id.startsWith('temp-') ? undefined : refreshExpiredMedia}
                mediaDuration={message.mediaDuration}
                uploadFailed={message.uploadFailed}
                onCancelUpload={message.id.startsWith('temp-') ? () => dispatch(cancelUpload(conversationId, message.id)) : undefined}
                onRetryUpload={() => dispatch(retryUpload(message.id))}
                onForward={() => setForwarding(message)}
                onDownload={message.mediaUrl ? () => handleDownload(message) : undefined}
              />
            );

  return (
    <div className="relative flex flex-col h-full min-w-0 bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-6 py-3 sm:py-4 border-b border-muted-200 bg-white/80 backdrop-blur-sm">
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

        {/* Avatar + name open the info panel */}
        <button
          type="button"
          onClick={() => setShowInfo(true)}
          className="flex-shrink-0 rounded-full"
          title={isGroup ? 'Group info' : 'Contact info'}
        >
          <Avatar
            src={conversationAvatar}
            alt={conversationName}
            size="md"
            online={isOnline}
          />
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setShowInfo(true)}>
          <h2 className="flex items-center gap-1.5 text-lg font-semibold text-muted-900 min-w-0">
            <span className="truncate">{conversationName}</span>
            {encryption.state === 'encrypted' && (
              <span title="End-to-end encrypted: only the people in this chat can read its messages" aria-label="End-to-end encrypted">
                <Lock className="w-3.5 h-3.5 text-muted-400 flex-shrink-0" />
              </span>
            )}
          </h2>

          {/* Status */}
          {isTyping ? (
            <p className="text-sm text-primary-600 font-medium">
              {isGroup ? typingText : 'Typing...'}
            </p>
          ) : (
            <p className="text-sm text-muted-500">
              {isGroup
                ? `${memberCount || 0} member${memberCount === 1 ? '' : 's'}`
                : isOnline ? 'Online' : 'Offline'}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Connection status indicator */}
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success-500' : 'bg-muted-300'}`}
            title={isConnected ? 'Connected' : 'Disconnected'}
          />

          {isGroup && (
            <button
              type="button"
              onClick={() => { setInfoAddMembers(true); setShowInfo(true); }}
              className="p-2 hover:bg-primary-50 rounded-lg transition-colors"
              title="Add members"
              aria-label="Add members"
            >
              <UserPlus className="w-5 h-5 text-primary-700" strokeWidth={1.75} />
            </button>
          )}
          <button
            onClick={() => setShowInfo(true)}
            className="p-2 hover:bg-muted-100 rounded-lg transition-colors"
            title={isGroup ? 'Group info' : 'Contact info'}
            aria-label={isGroup ? 'Group info' : 'Contact info'}
          >
            <svg className="w-5 h-5 text-muted-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Not end-to-end encrypted yet: say why */}
      {encryption.state === 'not-encrypted' && (
        <div className="flex items-start gap-2 px-4 sm:px-6 py-2 text-xs bg-warning-50 text-warning-800 border-b border-warning-100">
          <LockOpen className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            {isGroup
              ? `Not end-to-end encrypted yet: ${encryption.missing.length} member${encryption.missing.length === 1 ? " hasn't" : "s haven't"} set up encryption. New messages will be encrypted once everyone has.`
              : `Not end-to-end encrypted yet: ${conversationName} hasn't set up encryption. New messages will be encrypted once they do.`}
          </span>
        </div>
      )}

      {/* Messages Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 md:px-6 pt-6 pb-4 space-y-4"
      >
        {hasMoreMessages && (
          <div className="flex justify-center">
            <button
              onClick={handleLoadOlder}
              disabled={loadingOlder}
              className="px-4 py-1.5 text-sm text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-full transition-colors disabled:opacity-50"
            >
              {loadingOlder ? 'Loading…' : 'Load older messages'}
            </button>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-400">No messages yet. Say hello.</p>
          </div>
        ) : (
          <>
            {chatItems.map((item) => item.kind === 'album' ? (
              <AlbumGrid
                key={item.messages[0].id}
                messages={item.messages}
                isSent={item.messages[0].senderId === currentUserId}
                isGroup={isGroup}
                onOpen={openImage}
                onMediaError={refreshExpiredMedia}
              />
            ) : renderMessage(item.message))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Typing Indicator */}
      {isTyping && (
        <div className="px-6 py-2 text-sm text-muted-500">
          {typingText}
          <span className="inline-flex gap-1 ml-2">
            <span className="w-2 h-2 bg-muted-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2 h-2 bg-muted-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2 h-2 bg-muted-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </span>
        </div>
      )}

      {/* Message Input */}
      <div className="border-t border-muted-200 bg-white px-3 sm:px-5 py-3 mobile-nav-safe">
        <MessageInput
          onSend={handleSendMessage}
          onSendVoice={handleSendVoice}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          editingText={editingMessage ? editingMessage.text : null}
          onCancelEdit={() => setEditingMessage(null)}
          onTyping={handleTyping}
          placeholder={isConnected ? "Type a message..." : "Waiting for connection…"}
          disabled={!isConnected}
          showExpense
          onExpense={() => setAddingExpense(true)}
        />
      </div>

      {viewerIndex !== null && (
        <MediaViewer
          images={viewerImages}
          onForward={(id) => {
            const target = messages.find(m => m.id === id);
            if (target) setForwarding(target);
          }}
          index={Math.min(viewerIndex, viewerImages.length - 1)}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}

      {(addingExpense || openReceiptId) && (
        <AddExpenseSheet
          conversationId={conversationId}
          currentUserId={currentUserId}
          receiptId={openReceiptId || undefined}
          onClose={() => { setAddingExpense(false); if (openReceiptId) closeExpenseView(); }}
        />
      )}
      {forwarding && (
        <ForwardDialog
          message={forwarding}
          onSend={(ids) => dispatch(forwardMessage(forwarding, ids))}
          onClose={() => setForwarding(null)}
        />
      )}
      {openExpenseId && (
        <ExpenseDetail expenseId={openExpenseId} currentUserId={currentUserId} onClose={closeExpenseView} />
      )}

      <ConversationInfoPanel
        conversationId={conversationId}
        isOpen={showInfo}
        startAddingMembers={infoAddMembers}
        onClose={() => { setShowInfo(false); setInfoAddMembers(false); }}
      />
    </div>
  );
};

export default ChatWindow;