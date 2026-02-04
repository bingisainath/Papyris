// src/components/molecules/ContextMenu/index.tsx

import React, { useRef, useEffect } from 'react';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  items: ContextMenuItem[];
  position?: { x: number; y: number };
  anchorEl?: HTMLElement | null;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  isOpen,
  onClose,
  items,
  position,
  anchorEl,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Calculate position
  const getMenuStyle = (): React.CSSProperties => {
    if (position) {
      return {
        position: 'fixed',
        top: position.y,
        left: position.x,
      };
    }
    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      return {
        position: 'fixed',
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      };
    }
    return {};
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" />

      {/* Menu */}
      <div
        ref={menuRef}
        style={getMenuStyle()}
        className="z-50 min-w-[200px] bg-white rounded-xl shadow-lg border border-gray-200 py-2 animate-scale-in"
      >
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            {item.divider ? (
              <div className="my-1 border-t border-gray-200" />
            ) : (
              <button
                onClick={() => {
                  if (!item.disabled) {
                    item.onClick();
                    onClose();
                  }
                }}
                disabled={item.disabled}
                className={`
                  w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors
                  ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'}
                  ${item.danger ? 'text-red-600' : 'text-gray-700'}
                `}
              >
                {item.icon && <span className="text-lg">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
              </button>
            )}
          </React.Fragment>
        ))}
      </div>
    </>
  );
};

export default ContextMenu;


// ============================================
// USAGE EXAMPLES
// ============================================

/*
// Example 1: User Profile Context Menu
const userMenuItems: ContextMenuItem[] = [
  {
    id: 'view-profile',
    label: 'View Profile',
    icon: '👤',
    onClick: () => navigate(`/user/${userId}`),
  },
  {
    id: 'send-message',
    label: 'Send Message',
    icon: '💬',
    onClick: handleStartChat,
  },
  { id: 'divider-1', divider: true, label: '', onClick: () => {} },
  {
    id: 'block',
    label: isBlocked ? 'Unblock User' : 'Block User',
    icon: '🚫',
    onClick: handleBlockToggle,
    danger: !isBlocked,
  },
];

<ContextMenu
  isOpen={showUserMenu}
  onClose={() => setShowUserMenu(false)}
  items={userMenuItems}
  anchorEl={buttonRef.current}
/>

// Example 2: Message Context Menu
const messageMenuItems: ContextMenuItem[] = [
  {
    id: 'reply',
    label: 'Reply',
    icon: '↩️',
    onClick: () => handleReply(message),
  },
  {
    id: 'copy',
    label: 'Copy Text',
    icon: '📋',
    onClick: () => navigator.clipboard.writeText(message.text),
  },
  {
    id: 'forward',
    label: 'Forward',
    icon: '➡️',
    onClick: () => handleForward(message),
  },
  { id: 'divider-1', divider: true, label: '', onClick: () => {} },
  {
    id: 'delete',
    label: 'Delete Message',
    icon: '🗑️',
    onClick: () => handleDelete(message.id),
    danger: true,
    disabled: message.sender_id !== currentUserId,
  },
];

<ContextMenu
  isOpen={showMessageMenu}
  onClose={() => setShowMessageMenu(false)}
  items={messageMenuItems}
  position={menuPosition}
/>

// Example 3: Conversation Context Menu
const conversationMenuItems: ContextMenuItem[] = [
  {
    id: 'pin',
    label: conversation.isPinned ? 'Unpin' : 'Pin',
    icon: '📌',
    onClick: handleTogglePin,
  },
  {
    id: 'mute',
    label: 'Mute Notifications',
    icon: '🔕',
    onClick: handleMute,
  },
  {
    id: 'search',
    label: 'Search in Conversation',
    icon: '🔍',
    onClick: handleSearch,
  },
  { id: 'divider-1', divider: true, label: '', onClick: () => {} },
  {
    id: 'archive',
    label: 'Archive',
    icon: '📦',
    onClick: handleArchive,
  },
  {
    id: 'delete',
    label: 'Delete Conversation',
    icon: '🗑️',
    onClick: handleDeleteConversation,
    danger: true,
  },
];
*/