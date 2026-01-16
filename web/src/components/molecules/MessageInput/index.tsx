// src/components/molecules/MessageInput.tsx
import React, { useState, useRef, KeyboardEvent } from 'react';
import { Button } from '../../atoms';
import Icon from '../../atoms/Icon';

interface MessageInputProps {
  placeholder?: string;
  onSend: (message: string, file?: File) => void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  maxLength?: number;
  showAttachment?: boolean;
  showEmoji?: boolean;
  showExpense?: boolean; // For adding expense from chat
  className?: string;
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
  className = ''
}) => {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        if (!isTyping) {
          setIsTyping(true);
          onTyping(true);
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
    if (trimmedMessage && !disabled) {
      onSend(trimmedMessage);
      setMessage('');
      setIsTyping(false);
      if (onTyping) onTyping(false);
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
    if (file) {
      onSend('', file);
      e.target.value = ''; // Reset input
    }
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
        accept="image/*,video/*,.pdf,.doc,.docx"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Input container */}
      <div className="flex items-end gap-2 p-3">
        {/* Left actions */}
        <div className="flex items-center gap-1 pb-2">
          {showAttachment && (
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
            <button
              onClick={() => {
                // TODO: Implement emoji picker
                console.log('Emoji picker');
              }}
              disabled={disabled}
              className="p-2 hover:bg-muted-100 rounded-lg transition-colors disabled:opacity-50"
              title="Add emoji"
            >
              <Icon name="emoji" size={20} className="text-muted-500" />
            </button>
          )}

          {showExpense && (
            <button
              onClick={() => {
                // TODO: Open expense modal
                console.log('Add expense');
              }}
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
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="
            flex-1
            px-3 py-2
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
            disabled={disabled || !message.trim()}
            icon={<Icon name="send" size={18} />}
            className="rounded-xl px-4"
          >
            Send
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