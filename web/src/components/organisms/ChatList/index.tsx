// src/components/organisms/ChatList.tsx
import React, { useState, useMemo } from 'react';
import { Input, Button, Typography, Loading } from '../../atoms';
import Icon from '../../atoms/Icon';
import { ChatListItem } from '../../molecules';
import { useConversations } from '../../../hooks/useConversations';


interface Conversation {
  id: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  isOnline?: boolean;
  isTyping?: boolean;
  isPinned?: boolean;
  isGroup?: boolean;
}

interface ChatListProps {
  conversations: Conversation[];
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewChat?: () => void;
  onNewGroup?: () => void;
  isLoading?: boolean;
  className?: string;
}

const ChatList: React.FC<ChatListProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onNewGroup,
  isLoading = false,
  className = ''
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'direct' | 'groups'>('all');

  const { startDirectConversation } = useConversations();


  // Filter and search conversations
  const filteredConversations = useMemo(() => {
    // Safety check: default to empty array if conversations is undefined/null
    if (!conversations || !Array.isArray(conversations)) {
      return [];
    }

    let filtered = [...conversations]; // Create a copy to avoid mutating original

    // Apply type filter
    if (filter === 'direct') {
      filtered = filtered.filter(c => !c.isGroup);
    } else if (filter === 'groups') {
      filtered = filtered.filter(c => c.isGroup);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.lastMessage?.toLowerCase().includes(query)
      );
    }

    // Sort: pinned first, then by last message time
    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0; // Maintain original order for same pin status
    });
  }, [conversations, searchQuery, filter]);

  // Calculate stats
  const stats = useMemo(() => {
    // Safety check
    if (!conversations || !Array.isArray(conversations)) {
      return {
        total: 0,
        direct: 0,
        groups: 0,
        unread: 0
      };
    }

    return {
      total: conversations.length,
      direct: conversations.filter(c => !c.isGroup).length,
      groups: conversations.filter(c => c.isGroup).length,
      unread: conversations.filter(c => c.unreadCount && c.unreadCount > 0).length
    };
  }, [conversations]);

  return (
    <div className={`flex flex-col h-full bg-white/80 backdrop-blur-sm ${className}`}>
      {/* Header */}
      <div className="px-4 py-4 border-b border-muted-200">
        <div className="flex items-center justify-between mb-4">
          <Typography variant="h4" weight="bold" className="text-muted-900">
            Chats
          </Typography>
          <div className="flex items-center gap-2">
            {onNewChat && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="message" size={20} />}
                // onClick={onNewChat}
                onClick={() => startDirectConversation('c04bb06d-0412-4039-b45d-b95a6310dc7c')}
                title="New chat"
              />
            )}
            {onNewGroup && (
              <Button
                variant="primary"
                size="sm"
                icon={<Icon name="plus" size={20} />}
                onClick={onNewGroup}
                title="New group"
              />
            )}
          </div>
        </div>

        {/* Search */}
        <Input
          type="search"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Icon name="search" size={18} />}
          className="mb-3"
        />

        {/* Filters */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${filter === 'all' 
                ? 'bg-primary-600 text-white shadow-sm' 
                : 'bg-muted-100 text-muted-600 hover:bg-muted-200'
              }
            `}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setFilter('direct')}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${filter === 'direct' 
                ? 'bg-primary-600 text-white shadow-sm' 
                : 'bg-muted-100 text-muted-600 hover:bg-muted-200'
              }
            `}
          >
            Direct ({stats.direct})
          </button>
          <button
            onClick={() => setFilter('groups')}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${filter === 'groups' 
                ? 'bg-primary-600 text-white shadow-sm' 
                : 'bg-muted-100 text-muted-600 hover:bg-muted-200'
              }
            `}
          >
            Groups ({stats.groups})
          </button>
          {stats.unread > 0 && (
            <div className="ml-auto px-2 py-1 bg-accent-100 text-accent-600 rounded-full text-xs font-semibold">
              {stats.unread} unread
            </div>
          )}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loading variant="spinner" size="lg" text="Loading chats..." />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            {searchQuery ? (
              <>
                <div className="w-20 h-20 mb-4 rounded-full bg-muted-100 flex items-center justify-center">
                  <Icon name="search" size={32} className="text-muted-400" />
                </div>
                <Typography variant="h6" weight="semibold" className="text-muted-900 mb-2">
                  No results found
                </Typography>
                <Typography variant="body2" className="text-muted-500 max-w-xs">
                  Try searching with different keywords
                </Typography>
              </>
            ) : (
              <>
                <div className="w-20 h-20 mb-4 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center">
                  <Icon name="message" size={32} className="text-primary-600" />
                </div>
                <Typography variant="h6" weight="semibold" className="text-muted-900 mb-2">
                  No conversations yet
                </Typography>
                <Typography variant="body2" className="text-muted-500 max-w-xs mb-4">
                  Start a new conversation or create a group
                </Typography>
                <div className="flex gap-2">
                  {onNewChat && (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Icon name="message" size={18} />}
                      onClick={onNewChat}
                    >
                      New Chat
                    </Button>
                  )}
                  {onNewGroup && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Icon name="users" size={18} />}
                      onClick={onNewGroup}
                    >
                      New Group
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <ChatListItem
              key={conversation.id}
              {...conversation}
              isActive={conversation.id === activeConversationId}
              onClick={() => onSelectConversation(conversation.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ChatList;