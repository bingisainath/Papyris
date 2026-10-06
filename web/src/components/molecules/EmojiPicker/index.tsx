// src/components/molecules/EmojiPicker/index.tsx
import React, { useEffect, useRef } from 'react';

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉',
  '😍', '🥰', '😘', '😋', '😜', '🤪', '😎', '🤩', '🥳', '😏', '😒', '😞',
  '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤',
  '😠', '😡', '🤯', '😳', '😱', '😨', '🤔', '🤗', '🤭', '🤫', '😴', '🙄',
  '👍', '👎', '👌', '✌️', '🤞', '👏', '🙌', '🙏', '💪', '👋', '🤝', '👀',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '💔', '💯', '🔥', '✨', '🎉', '🎂',
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  className?: string;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClose, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Emoji picker"
      className={`z-30 w-72 max-w-[calc(100vw-2rem)] p-2 bg-white border border-muted-200 rounded-xl shadow-elevated ${className}`}
    >
      <div className="grid grid-cols-8 gap-0.5">
        {EMOJIS.map(emoji => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelect(emoji)}
            className="h-8 w-8 flex items-center justify-center text-xl rounded-lg hover:bg-muted-100 transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmojiPicker;
