// src/components/organisms/ChatList.tsx
import { Archive, ArrowLeft, Lock, MessageSquarePlus } from 'lucide-react';
import { searchMessages } from '../../../services/messageSearch';
import type { SearchHit } from '../../../services/messageSearch';
import { formatMessageTime } from '../../../utils/dateFormat';
import GroupAddIcon from '../../atoms/GroupAddIcon';
import React, { useEffect, useState, useMemo } from 'react';
import { Input, Button, Typography, Loading } from '../../atoms';
import Icon from '../../atoms/Icon';
import { useSelector } from 'react-redux';
import { ChatListItem } from '../../molecules';
import { selectAllTypingUsers, selectTypingNames } from '../../../redux/slices/websocketSlice';

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
  mutedUntil?: string | null;
  isArchived?: boolean;
}

interface ChatListProps {
  conversations: Conversation[];
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onToggleArchive?: (id: string, archived: boolean) => void;
  /** A message search result was picked: open that chat at that message. */
  onOpenMessage?: (conversationId: string, messageId: string) => void;
  currentUserId?: string;
  onNewChat?: () => void;
  onNewGroup?: () => void;
  isLoading?: boolean;
  className?: string;
}

const ChatList: React.FC<ChatListProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onTogglePin,
  onToggleArchive,
  onOpenMessage,
  currentUserId,
  onNewChat,
  onNewGroup,
  isLoading = false,
  className = ''
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const typingUsers = useSelector(selectAllTypingUsers);
  const typingNames = useSelector(selectTypingNames);

  // "typing..." for DMs; who is typing for groups
  const typingLabel = (conversation: Conversation) => {
    const ids = typingUsers[conversation.id] || [];
    if (!ids.length || !conversation.isGroup) return undefined;
    if (ids.length > 1) return `${ids.length} people are typing...`;
    return `${typingNames[ids[0]] || 'Someone'} is typing...`;
  };
  const [filter, setFilter] = useState<'all' | 'direct' | 'groups'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = (conversations || []).filter(c => c.isArchived).length;
  const archivedUnread = (conversations || []).filter(c => c.isArchived && (c.unreadCount || 0) > 0).length;

  // Message search (2+ characters): the server's results plus this browser's encrypted chats
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) { setHits(null); return; }
    let alive = true;
    const timer = window.setTimeout(() => {
      searchMessages(q).then((r) => { if (alive) setHits(r); }).catch(() => { if (alive) setHits([]); });
    }, 250);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [searchQuery]);

  // Filter and search conversations
  const filteredConversations = useMemo(() => {
    // Safety check: default to empty array if conversations is undefined/null
    if (!conversations || !Array.isArray(conversations)) {
      return [];
    }

    // Archived chats live in their own list (searching looks everywhere)
    let filtered = conversations.filter(c => searchQuery.trim() ? true : showArchived ? c.isArchived : !c.isArchived);

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
  }, [conversations, searchQuery, filter, showArchived]);

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

    const listed = conversations.filter(c => !c.isArchived);
    return {
      total: listed.length,
      direct: listed.filter(c => !c.isGroup).length,
      groups: listed.filter(c => c.isGroup).length,
      unread: listed.filter(c => c.unreadCount && c.unreadCount > 0).length
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
                icon={<MessageSquarePlus size={20} strokeWidth={1.75} />}
                // onClick={onNewChat}
                onClick={onNewChat}
                title="New chat"
              />
            )}
            {onNewGroup && (
              <Button
                variant="primary"
                size="sm"
                icon={<GroupAddIcon size={22} />}
                onClick={onNewGroup}
                title="New group"
              />
            )}
          </div>
        </div>

        {/* Search */}
        <Input
          type="search"
          placeholder="Search chats and messages..."
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
        {!searchQuery.trim() && showArchived && (
          <button type="button" onClick={() => setShowArchived(false)} className="flex items-center gap-2 px-2 py-1 text-sm font-semibold text-primary-700 hover:underline">
            <ArrowLeft className="w-4 h-4" /> Archived chats
          </button>
        )}
        {!searchQuery.trim() && !showArchived && archivedCount > 0 && (
          <button type="button" onClick={() => setShowArchived(true)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-muted-700 hover:bg-muted-100">
            <Archive className="w-4 h-4 text-muted-500" />
            <span className="flex-1 text-left font-medium">Archived</span>
            <span className={archivedUnread ? 'font-semibold text-primary-700' : 'text-muted-500'}>{archivedUnread || archivedCount}</span>
          </button>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loading variant="spinner" size="lg" text="Loading chats..." />
          </div>
        ) : filteredConversations.length === 0 && !searchQuery.trim() && !showArchived && archivedCount > 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-500">Your other chats are archived.</p>
        ) : filteredConversations.length === 0 && !(hits && hits.length) ? (
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
                <div className="w-20 h-20 mb-4 rounded-full bg-primary-100 flex items-center justify-center">
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
              unreadCount={conversation.unreadCount || 0}
              isOnline={conversation.isOnline}
              isActive={conversation.id === activeConversationId}
              isTyping={(typingUsers[conversation.id] || []).length > 0}
              typingText={typingLabel(conversation)}
              onClick={() => onSelectConversation(conversation.id)}
              onTogglePin={onTogglePin ? () => onTogglePin(conversation.id) : undefined}
              onToggleArchive={onToggleArchive ? () => onToggleArchive(conversation.id, !conversation.isArchived) : undefined}
            />
          ))
        )}

        {/* Messages that match the search */}
        {searchQuery.trim().length >= 2 && hits && hits.length > 0 && (
          <section aria-label="Messages" className="pt-2">
            <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-500">Messages</p>
            <ul className="space-y-1">
              {hits.map((h) => {
                const chat = conversations.find((c) => c.id === h.conversationId);
                const who = h.senderId && h.senderId === currentUserId ? 'You' : h.senderName;
                return (
                  <li key={h.id}>
                    <button type="button" onClick={() => onOpenMessage?.(h.conversationId, h.id)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-muted-100">
                      <span className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium text-muted-900 truncate">{chat?.name || 'Chat'}</span>
                        <span className="flex-shrink-0 text-xs text-muted-400">{formatMessageTime(h.timestamp)}</span>
                      </span>
                      <span className="flex items-center gap-1 text-sm text-muted-600">
                        {h.encrypted && <Lock className="w-3 h-3 flex-shrink-0 text-muted-400" aria-label="End-to-end encrypted" />}
                        <span className="truncate">{who ? `${who}: ` : ''}<Highlight text={h.text} query={searchQuery} /></span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
};

/** The text with every match of `query` in bold (case-insensitive). */
const Highlight: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
  return <>{parts.map((p, i) => (p.toLowerCase() === q.toLowerCase() ? <b key={i} className="text-muted-900">{p}</b> : p))}</>;
};

export default ChatList;