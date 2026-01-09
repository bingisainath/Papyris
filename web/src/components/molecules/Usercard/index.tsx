// src/components/molecules/UserCard.tsx
import React from 'react';
import { Avatar, Badge, Button, Typography } from '../../atoms';
import Icon from '../../atoms/Icon';

interface UserCardProps {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
  bio?: string;
  isOnline?: boolean;
  lastSeen?: string;
  mutualFriends?: number;
  balance?: number; // For expense balance (positive = they owe you, negative = you owe them)
  isSelected?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
  onMessage?: () => void;
  onSelect?: () => void;
  onRemove?: () => void;
  showActions?: boolean;
  className?: string;
}

const UserCard: React.FC<UserCardProps> = ({
  id,
  name,
  username,
  avatar,
  bio,
  isOnline = false,
  lastSeen,
  mutualFriends,
  balance,
  isSelected = false,
  variant = 'default',
  onMessage,
  onSelect,
  onRemove,
  showActions = true,
  className = ''
}) => {
  // Compact variant
  if (variant === 'compact') {
    return (
      <div
        onClick={onSelect}
        className={`
          flex items-center gap-3 p-3
          bg-white/80 backdrop-blur-sm
          rounded-xl
          border-2
          ${isSelected ? 'border-primary-600 bg-primary-50' : 'border-transparent hover:border-primary-200'}
          transition-all duration-200
          cursor-pointer
          ${className}
        `}
      >
        <Avatar src={avatar} alt={name} size="md" online={isOnline} />
        <div className="flex-1 min-w-0">
          <Typography variant="body2" weight="semibold" className="text-muted-900 truncate">
            {name}
          </Typography>
          {username && (
            <Typography variant="caption" className="text-muted-500 truncate">
              @{username}
            </Typography>
          )}
        </div>
        {isSelected && <Icon name="checkCircle" size={20} className="text-primary-600" />}
      </div>
    );
  }

  // Detailed variant
  if (variant === 'detailed') {
    return (
      <div
        className={`
          bg-white/90 backdrop-blur-sm
          rounded-2xl
          p-6
          shadow-card
          hover:shadow-elevated
          transition-all duration-300
          ${className}
        `}
      >
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <Avatar src={avatar} alt={name} size="xl" online={isOnline} />
          <div className="flex-1 min-w-0">
            <Typography variant="h5" weight="bold" className="text-muted-900 truncate">
              {name}
            </Typography>
            {username && (
              <Typography variant="body2" className="text-muted-500 mb-1">
                @{username}
              </Typography>
            )}
            {!isOnline && lastSeen && (
              <Typography variant="caption" className="text-muted-400">
                Last seen {lastSeen}
              </Typography>
            )}
            {isOnline && (
              <div className="flex items-center gap-1.5">
                <Badge dot variant="success" size="sm" />
                <Typography variant="caption" className="text-success-600">
                  Online
                </Typography>
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        {bio && (
          <Typography variant="body2" className="text-muted-600 mb-4">
            {bio}
          </Typography>
        )}

        {/* Stats */}
        <div className="flex gap-4 mb-4 p-4 bg-muted-50 rounded-xl">
          {mutualFriends !== undefined && (
            <div className="flex-1 text-center">
              <Typography variant="h6" className="text-muted-900">
                {mutualFriends}
              </Typography>
              <Typography variant="caption" className="text-muted-500">
                Mutual Friends
              </Typography>
            </div>
          )}
          
          {balance !== undefined && (
            <div className="flex-1 text-center">
              <Typography
                variant="h6"
                className={balance > 0 ? 'text-success-600' : balance < 0 ? 'text-accent-600' : 'text-muted-900'}
              >
                ${Math.abs(balance).toFixed(2)}
              </Typography>
              <Typography variant="caption" className="text-muted-500">
                {balance > 0 ? 'Owes you' : balance < 0 ? 'You owe' : 'Settled up'}
              </Typography>
            </div>
          )}
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex gap-2">
            {onMessage && (
              <Button
                variant="primary"
                size="md"
                icon={<Icon name="message" size={18} />}
                onClick={onMessage}
                fullWidth
              >
                Message
              </Button>
            )}
            {onRemove && (
              <Button
                variant="ghost"
                size="md"
                icon={<Icon name="close" size={18} />}
                onClick={onRemove}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div
      className={`
        flex items-center gap-4 p-4
        bg-white/90 backdrop-blur-sm
        rounded-2xl
        border-2
        ${isSelected ? 'border-primary-600 bg-primary-50' : 'border-transparent hover:border-primary-200'}
        shadow-soft
        hover:shadow-card
        transition-all duration-200
        ${className}
      `}
    >
      <Avatar src={avatar} alt={name} size="lg" online={isOnline} showRing={isSelected} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Typography variant="body1" weight="semibold" className="text-muted-900 truncate">
            {name}
          </Typography>
          {isOnline && <Badge dot variant="success" size="sm" />}
        </div>
        
        {username && (
          <Typography variant="body2" className="text-muted-500 truncate mb-1">
            @{username}
          </Typography>
        )}

        {bio && (
          <Typography variant="body2" className="text-muted-600 line-clamp-2">
            {bio}
          </Typography>
        )}

        {balance !== undefined && balance !== 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            <Icon name="wallet" size={14} className={balance > 0 ? 'text-success-600' : 'text-accent-600'} />
            <Typography
              variant="caption"
              weight="semibold"
              className={balance > 0 ? 'text-success-600' : 'text-accent-600'}
            >
              {balance > 0 ? `Owes you $${balance.toFixed(2)}` : `You owe $${Math.abs(balance).toFixed(2)}`}
            </Typography>
          </div>
        )}
      </div>

      {showActions && (
        <div className="flex flex-col gap-2">
          {onMessage && (
            <Button
              variant="primary"
              size="sm"
              icon={<Icon name="message" size={16} />}
              onClick={onMessage}
            />
          )}
          {onSelect && (
            <Button
              variant={isSelected ? 'success' : 'ghost'}
              size="sm"
              icon={<Icon name={isSelected ? 'checkCircle' : 'plus'} size={16} />}
              onClick={onSelect}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default UserCard;