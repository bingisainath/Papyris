// src/hooks/useBlockUser.ts

import { useState, useEffect } from 'react';
import { userService } from '../services/user.service';

export function useBlockUser(userId: string, token: string) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkBlockStatus();
  }, [userId]);

  const checkBlockStatus = async () => {
    try {
      setLoading(true);
      const response = await userService.getBlockedUsers(token);
      if (response.success && response.data) {
        const blocked = response.data.blocked_users.some((user) => user.id === userId);
        setIsBlocked(blocked);
      }
    } catch (error) {
      console.error('Error checking block status:', error);
    } finally {
      setLoading(false);
    }
  };

  const blockUser = async () => {
    try {
      setBlocking(true);
      await userService.blockUser(userId, token);
      setIsBlocked(true);
    } catch (error) {
      console.error('Error blocking user:', error);
      throw error;
    } finally {
      setBlocking(false);
    }
  };

  const unblockUser = async () => {
    try {
      setBlocking(true);
      await userService.unblockUser(userId, token);
      setIsBlocked(false);
    } catch (error) {
      console.error('Error unblocking user:', error);
      throw error;
    } finally {
      setBlocking(false);
    }
  };

  return { 
    isBlocked, 
    blocking, 
    loading,
    blockUser, 
    unblockUser, 
    refresh: checkBlockStatus 
  };
}