// src/components/molecules/MessageInput.tsx
import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { toast } from 'react-toastify';
import { Button } from '../../atoms';
import Icon from '../../atoms/Icon';
import EmojiPicker from '../EmojiPicker';
import { ACCEPTED_FILE_TYPES, formatFileSize, mediaTypeOf, validateFile } from '../../../utils/media';

const TYPING_REPEAT_MS = 2500;

interface MessageInputProps {
  placeholder?: string;
  onSend: (message: string, file?: File) => void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  maxLength?: number;
  showAttachment?: boolean;
  showEmoji?: boolean;
  showExpense?: boolean; // For adding expense from chat
  onExpense?: () => void;
  className?: string;
  replyingTo?: { senderName?: string | null; text: string } | null;
  onCancelReply?: () => void;
  editingText?: string | null; // set while editing a sent message
  onCancelEdit?: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({
  placeholder = 'Type a message...',
  onSend,
  onTyping,
  disabled = false,
  maxLength = 5000,
  showAttachment = true,
  showEmoji = true,
  showExpense = false,
  onExpense,
  className = '',
  replyingTo = null,
  onCancelReply,
  editingText = null,
  onCancelEdit
}) => {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const isEditing = editingText !== null;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentAt = useRef(0);

  // Free the preview's object URL when it changes or the input unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Entering edit mode loads the message text; leaving it clears the box
  useEffect(() => {
    setMessage(editingText ?? '');
    if (editingText !== null) {
      setPendingFile(null);
      setPreviewUrl(null);
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        textarea?.focus();
        textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
      });
    }
  }, [editingText]);

  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus();
  }, [replyingTo]);

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? message.length;
    const end = textarea?.selectionEnd ?? message.length;
    const next = message.slice(0, start) + emoji + message.slice(end);
    if (next.length > maxLength) return;
    setMessage(next);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const clearAttachment = () => {
    setPendingFile(null);
    setPreviewUrl(null);
  };

  // Auto-resize textarea
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= maxLength) {
      setMessage(value);
      adjustHeight();

      // Handle typing indicator
      if (onTyping) {
        // Repeat "typing" while the user keeps typing; receivers clear it if it stops arriving
        const now = Date.now();
        if (!isTyping || now - lastTypingSentAt.current > TYPING_REPEAT_MS) {
          setIsTyping(true);
          onTyping(true);
          lastTypingSentAt.current = now;
        }

        // Clear existing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        // Set new timeout to stop typing indicator
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
          onTyping(false);
        }, 2000);
      }
    }
  };

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if ((trimmedMessage || pendingFile || isEditing) && !disabled) {
      onSend(trimmedMessage, pendingFile ?? undefined);
      setMessage('');
      clearAttachment();
      setIsTyping(false);
      if (onTyping) onTyping(false);
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      if (isEditing) onCancelEdit?.();
      else if (replyingTo) onCancelReply?.();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAttachment = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // Reset input so the same file can be picked again
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      toast.error(`${file.name}: ${error}`);
      return;
    }

    setPendingFile(file);
    setPreviewUrl(mediaTypeOf(file) === 'file' ? null : URL.createObjectURL(file));
    textareaRef.current?.focus();
  };

  return (
    <div
      className={`
        relative
        bg-white/90 backdrop-blur-sm
        border-2
        ${isFocused ? 'border-primary-600 shadow-card' : 'border-muted-200'}
        rounded-2xl
        transition-all duration-200
        ${className}
      `}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Reply / edit banner */}
      {(isEditing || replyingTo) && (
        <div className="flex items-center gap-3 mx-3 mt-3 pl-3 pr-1.5 py-2 bg-primary-50 border-l-4 border-primary-600 rounded-lg">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary-700">
              {isEditing ? 'Editing message' : `Replying to ${replyingTo?.senderName || 'message'}`}
            </p>
            {!isEditing && (
              <p className="text-sm text-muted-600 truncate">{replyingTo?.text}</p>
            )}
          </div>
          <button
            onClick={isEditing ? onCancelEdit : onCancelReply}
            className="p-1.5 hover:bg-primary-100 rounded-lg transition-colors"
            title={isEditing ? 'Cancel editing' : 'Cancel reply'}
          >
            <Icon name="close" size={16} className="text-muted-500" />
          </button>
        </div>
      )}

      {/* Attachment preview (sent together with the caption) */}
      {pendingFile && (
        <div className="flex items-center gap-3 px-3 pt-3">
          {previewUrl && mediaTypeOf(pendingFile) === 'image' && (
            <img src={previewUrl} alt={pendingFile.name} className="h-16 w-16 rounded-lg object-cover" />
          )}
          {previewUrl && mediaTypeOf(pendingFile) === 'video' && (
            <video src={previewUrl} muted className="h-16 w-16 rounded-lg object-cover bg-black" />
          )}
          {!previewUrl && (
            <div className="h-16 w-16 rounded-lg bg-muted-100 flex items-center justify-center">
              <Icon name="attach" size={24} className="text-muted-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-900 truncate">{pendingFile.name}</p>
            <p className="text-xs text-muted-500">{formatFileSize(pendingFile.size)} · add a caption or press Send</p>
          </div>
          <button
            onClick={clearAttachment}
            className="p-1.5 hover:bg-muted-100 rounded-lg transition-colors"
            title="Remove attachment"
          >
            <Icon name="close" size={18} className="text-muted-500" />
          </button>
        </div>
      )}

      {/* Input container */}
      <div className="flex items-end gap-1 sm:gap-2 p-2 sm:p-3">
        {/* Left actions */}
        <div className="flex items-center gap-1 pb-2">
          {showAttachment && !isEditing && (
            <button
              onClick={handleAttachment}
              disabled={disabled}
              className="p-2 hover:bg-muted-100 rounded-lg transition-colors disabled:opacity-50"
              title="Attach file"
            >
              <Icon name="attach" size={20} className="text-muted-500" />
            </button>
          )}

          {showEmoji && (
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(open => !open)}
                disabled={disabled}
                className="p-2 hover:bg-muted-100 rounded-lg transition-colors disabled:opacity-50"
                title="Add emoji"
              >
                <Icon name="emoji" size={20} className="text-muted-500" />
              </button>
              {showEmojiPicker && (
                <EmojiPicker
                  className="absolute bottom-full left-0 mb-2"
                  onSelect={insertEmoji}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
            </div>
          )}

          {showExpense && (
            <button
              type="button"
              onClick={onExpense}
              disabled={disabled}
              className="p-2 hover:bg-accent-50 rounded-lg transition-colors disabled:opacity-50"
              title="Add expense"
            >
              <Icon name="dollar" size={20} className="text-accent-500" />
            </button>
          )}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={isEditing ? 'Edit message…' : pendingFile ? 'Add a caption…' : placeholder}
          disabled={disabled}
          rows={1}
          className="
            flex-1
            min-w-0
            px-2 sm:px-3 py-2
            bg-transparent
            border-none
            outline-none
            resize-none
            text-muted-900
            placeholder:text-muted-400
            disabled:opacity-50
            max-h-[150px]
            overflow-y-auto
          "
          style={{ minHeight: '40px' }}
        />

        {/* Send button */}
        <div className="pb-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleSend}
            disabled={disabled || (!message.trim() && !pendingFile && !isEditing)}
            icon={<Icon name="send" size={18} />}
            className="rounded-xl px-3 sm:px-4"
          >
            <span className="hidden sm:inline">{isEditing ? 'Save' : 'Send'}</span>
          </Button>
        </div>
      </div>

      {/* Character counter */}
      {message.length > maxLength * 0.8 && (
        <div className="px-4 pb-2 text-right">
          <span className={`text-xs ${message.length >= maxLength ? 'text-accent-600' : 'text-muted-400'}`}>
            {message.length}/{maxLength}
          </span>
        </div>
      )}

      {/* Hint text */}
      {/* {!disabled && !message && (
        <div className="px-4 pb-2 text-xs text-muted-400">
          Press Enter to send, Shift+Enter for new line
        </div>
      )} */}
    </div>
  );
};

export default MessageInput;