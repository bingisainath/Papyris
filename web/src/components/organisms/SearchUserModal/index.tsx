// src/components/organisms/SearchUserModal.tsx - WITH DEBOUNCING

import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, Typography } from '../../atoms';
import Icon from '../../atoms/Icon';
import { UserCard } from '../../molecules';
import { useDebounce } from '../../../hooks/useDebounce';
import { userService } from '../../../services/user.service';

interface User {
  id: string;
  name: string;
  username?: string;
  email?: string;
  avatar?: string;
  isOnline?: boolean;
}

interface SearchUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: User) => void;
  currentUserId: string;
}

const SearchUserModal: React.FC<SearchUserModalProps> = ({
  isOpen,
  onClose,
  onSelectUser,
  currentUserId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search query (500ms delay)
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setSearchQuery('');
      setUsers([]);
      setError('');
    }
  }, [isOpen]);

  // Search users when debounced query changes
  useEffect(() => {
    if (debouncedSearchQuery.trim()) {
      searchUsers(debouncedSearchQuery);
    } else {
      setUsers([]);
      setError('');
    }
  }, [debouncedSearchQuery]);

  // Early return after all hooks
  if (!isOpen) return null;

  const searchUsers = async (query: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await userService.searchUsers(query);

      if (response.success && response.data) {
        const filteredUsers = response.data
          .filter((u: any) => u.id !== currentUserId)
          .map((u: any) => ({
            id: u.id,
            name: u.name || u.username,
            username: u.username,
            email: u.email,
            avatar: u.avatar,
            isOnline: u.is_online
          }));

        setUsers(filteredUsers);
        setSelectedIndex(0);

        if (filteredUsers.length === 0) {
          setError('No users found');
        }
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.response?.data?.detail || 'Failed to search users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (user: User) => {
    onSelectUser(user);
    handleClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    setUsers([]);
    setError('');
    setSelectedIndex(0);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (users.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % users.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + users.length) % users.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (users[selectedIndex]) {
          handleSelectUser(users[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        handleClose();
        break;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-elevated max-w-md w-full max-h-[80vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-muted-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-secondary-400 flex items-center justify-center">
              <Icon name="message-square" size={22} className="text-white" />
            </div>
            <div>
              <Typography variant="h5" weight="bold" className="text-muted-900">
                New Chat
              </Typography>
              <Typography variant="caption" className="text-muted-500">
                Search by username or email
              </Typography>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon name="close" size={20} />}
            onClick={handleClose}
          />
        </div>

        {/* Search Input */}
        <div className="px-6 py-4 border-b border-muted-200">
          <div className="relative">
            <Input
              ref={inputRef}
              type="search"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              leftIcon={<Icon name="search" size={18} />}
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
              </div>
            )}
          </div>
          {searchQuery && (
            <Typography variant="caption" className="text-muted-500 mt-2">
              {loading ? 'Searching...' : `Found ${users.length} user${users.length !== 1 ? 's' : ''}`}
            </Typography>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!searchQuery ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Icon name="search" size={48} className="text-muted-300 mb-3" />
              <Typography variant="body1" weight="semibold" className="text-muted-700 mb-1">
                Search for a user
              </Typography>
              <Typography variant="body2" className="text-muted-500">
                Type a username or email to find people
              </Typography>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-3"></div>
              <Typography variant="body2" className="text-muted-500">
                Searching...
              </Typography>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Icon name="alert-circle" size={48} className="text-accent-500 mb-3" />
              <Typography variant="body1" weight="semibold" className="text-muted-700 mb-1">
                {error}
              </Typography>
              <Typography variant="body2" className="text-muted-500">
                Try a different search term
              </Typography>
            </div>
          ) : users.length > 0 ? (
            <div className="space-y-2">
              {users.map((user, index) => (
                <UserCard
                  key={user.id}
                  {...user}
                  variant="compact"
                  isSelected={index === selectedIndex}
                  onSelect={() => handleSelectUser(user)}
                  showActions={false}
                />
              ))}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {users.length > 0 && (
          <div className="px-6 py-3 border-t border-muted-200 bg-muted-50">
            <Typography variant="caption" className="text-muted-500 text-center">
              Use ↑↓ to navigate, Enter to select, Esc to close
            </Typography>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchUserModal;