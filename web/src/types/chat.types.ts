// src/types/chat.types.ts

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  created_at: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  sender?: {
    id: string;
    username: string;
    email: string;
    avatar?: string;
  };
  media_url?: string;
  media_type?: 'image' | 'video' | 'file';
}

export interface Conversation {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  lastMessageTime?: string;
  unreadCount: number;
  isOnline: boolean;
  isGroup: boolean;
  members: string[];
  isPinned?: boolean;
  isTyping?: boolean;
}

export interface SearchResult {
  message: {
    id: string;
    text: string;
    timestamp: string;
    sender_id: string;
    sender_name: string;
  };
  conversation: {
    id: string;
    name: string;
    avatar?: string;
  } | null;
  matches: number;
}