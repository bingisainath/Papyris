// src/components/molecules/GroupCard.tsx
import React from 'react';
import { Avatar, Badge, Button, Typography } from '../../atoms';
import Icon from '../../atoms/Icon';

interface GroupMember {
  id: string;
  name: string;
  avatar?: string;
}

interface GroupCardProps {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  memberCount: number;
  members?: GroupMember[]; // Show first few members
  unreadCount?: number;
  lastActivity?: string;
  totalExpenses?: number; // Total group expenses
  yourBalance?: number; // Your balance in the group
  isActive?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
  onOpen?: () => void;
  onViewExpenses?: () => void;
  onEdit?: () => void;
  onLeave?: () => void;
  className?: string;
}

const GroupCard: React.FC<GroupCardProps> = ({
  id,
  name,
  description,
  avatar,
  memberCount,
  members = [],
  unreadCount = 0,
  lastActivity,
  totalExpenses,
  yourBalance,
  isActive = false,
  variant = 'default',
  onOpen,
  onViewExpenses,
  onEdit,
  onLeave,
  className = ''
}) => {
  // Compact variant for lists
  if (variant === 'compact') {
    return (
      <div
        onClick={onOpen}
        className={`
          flex items-center gap-3 p-3
          bg-white/80 backdrop-blur-sm
          rounded-xl
          border-2
          ${isActive ? 'border-primary-600 bg-primary-50' : 'border-transparent hover:border-primary-200'}
          transition-all duration-200
          cursor-pointer
          ${className}
        `}
      >
        <Avatar src={avatar} alt={name} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon name="users" size={14} className="text-muted-500" />
            <Typography variant="body2" weight="semibold" className="text-muted-900 truncate">
              {name}
            </Typography>
          </div>
          <Typography variant="caption" className="text-muted-500">
            {memberCount} members
          </Typography>
        </div>
        {unreadCount > 0 && <Badge count={unreadCount} variant="primary" size="sm" />}
      </div>
    );
  }

  // Detailed variant for full view
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
          <Avatar src={avatar} alt={name} size="xl" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="users" size={18} className="text-primary-600" />
              <Typography variant="h5" weight="bold" className="text-muted-900 truncate">
                {name}
              </Typography>
            </div>
            <Typography variant="body2" className="text-muted-500 mb-1">
              {memberCount} members
            </Typography>
            {lastActivity && (
              <Typography variant="caption" className="text-muted-400">
                Last activity: {lastActivity}
              </Typography>
            )}
          </div>
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon name="edit" size={16} />}
              onClick={onEdit}
            />
          )}
        </div>

        {/* Description */}
        {description && (
          <Typography variant="body2" className="text-muted-600 mb-4">
            {description}
          </Typography>
        )}

        {/* Members preview */}
        {members.length > 0 && (
          <div className="mb-4">
            <Typography variant="caption" className="text-muted-500 mb-2 block">
              Members
            </Typography>
            <div className="flex -space-x-2">
              {members.slice(0, 5).map((member) => (
                <Avatar
                  key={member.id}
                  src={member.avatar}
                  alt={member.name}
                  size="sm"
                  className="ring-2 ring-white"
                />
              ))}
              {memberCount > 5 && (
                <div className="w-8 h-8 rounded-full bg-muted-200 border-2 border-white flex items-center justify-center">
                  <Typography variant="caption" className="text-muted-600 text-xs">
                    +{memberCount - 5}
                  </Typography>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Expenses summary */}
        {(totalExpenses !== undefined || yourBalance !== undefined) && (
          <div className="grid grid-cols-2 gap-3 mb-4 p-4 bg-muted-50 rounded-xl">
            {totalExpenses !== undefined && (
              <div className="text-center">
                <Typography variant="h6" className="text-muted-900">
                  ${totalExpenses.toFixed(2)}
                </Typography>
                <Typography variant="caption" className="text-muted-500">
                  Total Expenses
                </Typography>
              </div>
            )}
            {yourBalance !== undefined && (
              <div className="text-center">
                <Typography
                  variant="h6"
                  className={yourBalance > 0 ? 'text-success-600' : yourBalance < 0 ? 'text-accent-600' : 'text-muted-900'}
                >
                  ${Math.abs(yourBalance).toFixed(2)}
                </Typography>
                <Typography variant="caption" className="text-muted-500">
                  {yourBalance > 0 ? 'You are owed' : yourBalance < 0 ? 'You owe' : 'Settled up'}
                </Typography>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {onOpen && (
            <Button
              variant="primary"
              size="md"
              icon={<Icon name="message" size={18} />}
              onClick={onOpen}
              fullWidth
            >
              Open Chat
            </Button>
          )}
          {onViewExpenses && (
            <Button
              variant="secondary"
              size="md"
              icon={<Icon name="dollar" size={18} />}
              onClick={onViewExpenses}
            >
              Expenses
            </Button>
          )}
        </div>

        {onLeave && (
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon name="logout" size={16} />}
            onClick={onLeave}
            className="w-full mt-2 text-accent-600 hover:bg-accent-50"
          >
            Leave Group
          </Button>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div
      onClick={onOpen}
      className={`
        relative
        bg-white/90 backdrop-blur-sm
        rounded-2xl
        p-4
        border-2
        ${isActive ? 'border-primary-600 bg-primary-50' : 'border-transparent hover:border-primary-200'}
        shadow-soft
        hover:shadow-card
        hover:scale-[1.01]
        transition-all duration-200
        cursor-pointer
        ${className}
      `}
    >
      {/* Unread badge */}
      {unreadCount > 0 && (
        <div className="absolute top-3 right-3">
          <Badge count={unreadCount} variant="primary" size="sm" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <Avatar src={avatar} alt={name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="users" size={16} className="text-primary-600" />
            <Typography variant="body1" weight="semibold" className="text-muted-900 truncate">
              {name}
            </Typography>
          </div>
          {description && (
            <Typography variant="body2" className="text-muted-600 line-clamp-2 mb-2">
              {description}
            </Typography>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-500">
            <span>{memberCount} members</span>
            {lastActivity && (
              <>
                <span>•</span>
                <span>{lastActivity}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Members preview */}
      {members.length > 0 && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex -space-x-2">
            {members.slice(0, 4).map((member) => (
              <Avatar
                key={member.id}
                src={member.avatar}
                alt={member.name}
                size="xs"
                className="ring-2 ring-white"
              />
            ))}
            {memberCount > 4 && (
              <div className="w-6 h-6 rounded-full bg-muted-200 border-2 border-white flex items-center justify-center">
                <Typography variant="caption" className="text-muted-600 text-[10px]">
                  +{memberCount - 4}
                </Typography>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expenses info */}
      {(totalExpenses !== undefined || yourBalance !== undefined) && (
        <div className="flex items-center justify-between pt-3 border-t border-muted-100">
          {totalExpenses !== undefined && (
            <div className="flex items-center gap-1.5">
              <Icon name="receipt" size={14} className="text-muted-500" />
              <Typography variant="caption" className="text-muted-600">
                ${totalExpenses.toFixed(2)} total
              </Typography>
            </div>
          )}
          {yourBalance !== undefined && yourBalance !== 0 && (
            <div className="flex items-center gap-1.5">
              <Icon name="wallet" size={14} className={yourBalance > 0 ? 'text-success-600' : 'text-accent-600'} />
              <Typography
                variant="caption"
                weight="semibold"
                className={yourBalance > 0 ? 'text-success-600' : 'text-accent-600'}
              >
                {yourBalance > 0 ? `+$${yourBalance.toFixed(2)}` : `-$${Math.abs(yourBalance).toFixed(2)}`}
              </Typography>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GroupCard;