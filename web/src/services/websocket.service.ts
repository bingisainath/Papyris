// src/services/websocket.service.ts

import { io, Socket } from 'socket.io-client';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  text: string;
  timestamp: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'file';
}

export interface WebSocketEvent {
  type: 'message' | 'typing' | 'read' | 'joined' | 'left' | 'online' | 'offline' | 'error';
  roomId?: string;
  userId?: string;
  messageId?: string;
  senderId?: string;
  text?: string;
  timestamp?: string;
  status?: string;
  isTyping?: boolean;
  lastMessageId?: string;
  message?: string;
}

type EventCallback = (event: WebSocketEvent) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private isConnecting = false;
  private shouldReconnect = true;
  private token: string | null = null;
  private wsUrl: string;

  constructor() {
    // WebSocket URL - adjust for your backend
    this.wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/api/v1/ws/chat';
  }

  /**
   * Connect to WebSocket server
   */
  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        console.log('✅ WebSocket already connected');
        resolve();
        return;
      }

      if (this.isConnecting) {
        console.log('⏳ Connection already in progress');
        reject(new Error('Connection already in progress'));
        return;
      }

      this.token = token;
      this.isConnecting = true;
      this.shouldReconnect = true;

      try {
        // Add token as query parameter
        const url = `${this.wsUrl}?token=${encodeURIComponent(token)}`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('✅ WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emit('connected', {});
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data: WebSocketEvent = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('❌ Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.isConnecting = false;
          this.emit('error', { type: 'error', message: 'Connection error' });
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('🔌 WebSocket disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.stopHeartbeat();
          this.emit('disconnected', {});

          // Auto-reconnect if not intentional disconnect
          if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        console.error('❌ Failed to create WebSocket connection:', error);
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    console.log('👋 WebSocket disconnected by user');
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Send event to server
   */
  private send(data: any) {
    if (!this.isConnected()) {
      console.error('❌ WebSocket not connected');
      throw new Error('WebSocket not connected');
    }

    this.ws!.send(JSON.stringify(data));
  }

  /**
   * Join a conversation room
   */
  joinConversation(conversationId: string) {
    console.log(`📥 Joining conversation: ${conversationId}`);
    this.send({
      type: 'join',
      roomId: conversationId
    });
  }

  /**
   * Leave a conversation room
   */
  leaveConversation(conversationId: string) {
    console.log(`📤 Leaving conversation: ${conversationId}`);
    this.send({
      type: 'leave',
      roomId: conversationId
    });
  }

  /**
   * Send a message
   */
  sendMessage(conversationId: string, text: string) {
    console.log(`💬 Sending message to ${conversationId}`);
    this.send({
      type: 'message',
      roomId: conversationId,
      text
    });
  }

  /**
   * Send typing indicator
   */
  sendTyping(conversationId: string, isTyping: boolean) {
    this.send({
      type: 'typing',
      roomId: conversationId,
      isTyping
    });
  }

  /**
   * Mark message as read
   */
  markAsRead(conversationId: string, lastMessageId: string) {
    this.send({
      type: 'read',
      roomId: conversationId,
      lastMessageId
    });
  }

  /**
   * Add event listener
   */
  on(event: string, callback: EventCallback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: EventCallback) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Handle incoming message from server
   */
  private handleMessage(data: WebSocketEvent) {
    console.log('📨 Received:', data.type, data);

    // Emit specific event type
    this.emit(data.type, data);

    // Emit generic 'message' event for all messages
    if (data.type === 'message') {
      this.emit('new-message', data);
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        // Send ping (you can customize this based on your backend)
        try {
          this.ws!.send(JSON.stringify({ type: 'ping' }));
        } catch (error) {
          console.error('Heartbeat failed:', error);
        }
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      if (this.shouldReconnect && this.token) {
        console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}`);
        this.connect(this.token).catch(error => {
          console.error('Reconnection failed:', error);
        });
      }
    }, delay);
  }
}

// Export singleton instance
export const wsService = new WebSocketService();