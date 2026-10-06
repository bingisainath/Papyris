// src/hooks/useConversations.ts
import { useSelector, useDispatch } from 'react-redux';
import { useEffect } from 'react';
import type { RootState } from '../redux/store';
import { createDirectConversation } from '../api/chat.api';
import { useNavigate } from 'react-router-dom';

/**
 * Hook to manage conversations data
 */
export const useConversations = () => {
  const dispatch = useDispatch();

  const navigate = useNavigate();

  // Select conversations from Redux store
  const conversations = useSelector((state: RootState) => state.chat?.conversations || []);
  const isLoading = useSelector((state: RootState) => state.chat?.isLoading || false);
  const error = useSelector((state: RootState) => state.chat?.error);

  // Fetch conversations on mount
  // useEffect(() => {
  //   // dispatch(fetchConversations());
  // }, [dispatch]);

  const startDirectConversation = async (userId: string) => {

    const conversation = await createDirectConversation(userId);
    navigate(`/chat/${conversation.id}`);
  };

  // Return conversations and helper functions
  return {
    conversations,
    startDirectConversation,
    isLoading,
    error,
    // Add action dispatchers
    // createConversation: (data: any) => dispatch(createConversation(data)),
    // deleteConversation: (id: string) => dispatch(deleteConversation(id)),
  };
};

/**
 * Hook to manage messages for a specific conversation
 */
export const useMessages = (conversationId?: string) => {
  const dispatch = useDispatch();

  const messages = useSelector((state: RootState) =>
    conversationId ? state.chat?.messages[conversationId] || [] : []
  );
  const isLoading = useSelector((state: RootState) => state.chat?.messagesLoading || false);

  useEffect(() => {
    if (conversationId) {
      // dispatch(fetchMessages(conversationId));
    }
  }, [conversationId, dispatch]);

  return {
    messages,
    isLoading,
    // sendMessage: (text: string, file?: File) => dispatch(sendMessage({ conversationId, text, file })),
    // loadMoreMessages: () => dispatch(loadMoreMessages(conversationId)),
  };
};

/**
 * Hook to manage groups
 */
export const useGroups = () => {
  const dispatch = useDispatch();

  const groups = useSelector((state: RootState) =>
    state.chat?.conversations.filter((c: any) => c.isGroup) || []
  );
  const isLoading = useSelector((state: RootState) => state.chat?.isLoading || false);

  return {
    groups,
    isLoading,
    // createGroup: (data: any) => dispatch(createGroup(data)),
    // updateGroup: (id: string, data: any) => dispatch(updateGroup(id, data)),
    // leaveGroup: (id: string) => dispatch(leaveGroup(id)),
  };
};

/**
 * Hook to manage WebSocket connection
 */
export const useWebSocket = () => {
  const dispatch = useDispatch();
  const isConnected = useSelector((state: RootState) => state.websocket?.isConnected || false);

  useEffect(() => {
    // Connect WebSocket on mount
    // dispatch(connectWebSocket());

    // Disconnect on unmount
    return () => {
      // dispatch(disconnectWebSocket());
    };
  }, [dispatch]);

  return {
    isConnected,
    // reconnect: () => dispatch(connectWebSocket()),
  };
};