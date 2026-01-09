
// src/components/molecules/ExpenseItem.tsx
import React from 'react';
import { Avatar, Badge, Button, Typography } from '../../atoms';
import Icon from '../../atoms/Icon';

type ExpenseStatus = 'pending' | 'settled' | 'partial';
type SplitType = 'equal' | 'percentage' | 'custom';

interface ExpenseShare {
  userId: string;
  userName: string;
  userAvatar?: string;
  amount: number;
  paid?: boolean;
}

interface ExpenseItemProps {
  id: string;
  description: string;
  totalAmount: number;
  paidBy: {
    id: string;
    name: string;
    avatar?: string;
  };
  category?: string;
  date: string;
  status: ExpenseStatus;
  splitType?: SplitType;
  shares: ExpenseShare[];
  currentUserId: string; // To determine if user owes or is owed
  onSettle?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onClick?: () => void;
  className?: string;
}

const ExpenseItem: React.FC<ExpenseItemProps> = ({
  id,
  description,
  totalAmount,
  paidBy,
  category,
  date,
  status,
  splitType = 'equal',
  shares,
  currentUserId,
  onSettle,
  onEdit,
  onDelete,
  onClick,
  className = ''
}) => {
  // Calculate user's share
  const userShare = shares.find(s => s.userId === currentUserId);
  const userAmount = userShare?.amount || 0;
  const isPayer = paidBy.id === currentUserId;
  const isOwed = isPayer && status !== 'settled';
  const owes = !isPayer && !userShare?.paid;

  // Calculate total owed/owing
  const totalOwed = isPayer
    ? shares.filter(s => s.userId !== currentUserId && !s.paid).reduce((sum, s) => sum + s.amount, 0)
    : userAmount;

  // Status colors
  const statusConfig: Record<ExpenseStatus, { color: string; bg: string; border: string; text: string }> = {
    pending: {
      color: 'text-accent-600',
      bg: 'bg-accent-50',
      border: 'border-accent-500',
      text: 'Pending'
    },
    settled: {
      color: 'text-success-600',
      bg: 'bg-success-50',
      border: 'border-success-500',
      text: 'Settled'
    },
    partial: {
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      border: 'border-yellow-500',
      text: 'Partially Paid'
    }
  };

  const categoryIcons: Record<string, string> = {
    food: '🍕',
    transport: '🚗',
    entertainment: '🎬',
    shopping: '🛍️',
    utilities: '💡',
    other: '📝'
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative
        bg-white/90 backdrop-blur-sm
        rounded-2xl
        p-4
        border-l-4 ${statusConfig[status].border}
        shadow-card
        hover:shadow-elevated
        hover:scale-[1.01]
        transition-all duration-300
        cursor-pointer
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Category icon */}
          {category && (
            <div className="flex-shrink-0 text-2xl">
              {categoryIcons[category.toLowerCase()] || categoryIcons.other}
            </div>
          )}

          {/* Description and details */}
          <div className="flex-1 min-w-0">
            <Typography variant="body1" weight="semibold" className="text-muted-900 truncate">
              {description}
            </Typography>
            
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-500">
              <span>{date}</span>
              {splitType && (
                <>
                  <span>•</span>
                  <span className="capitalize">{splitType} split</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status badge */}
        <Badge variant={status === 'settled' ? 'success' : status === 'partial' ? 'warning' : 'accent'}>
          {statusConfig[status].text}
        </Badge>
      </div>

      {/* Amount section */}
      <div className="flex items-center justify-between mb-3 p-3 bg-muted-50 rounded-xl">
        <div className="flex items-center gap-2">
          <Icon name="dollar" size={20} className="text-muted-500" />
          <div>
            <Typography variant="caption" className="text-muted-500">
              Total Amount
            </Typography>
            <Typography variant="body1" weight="bold" className="text-muted-900">
              ${totalAmount.toFixed(2)}
            </Typography>
          </div>
        </div>

        {/* User's share */}
        <div className="text-right">
          <Typography variant="caption" className="text-muted-500">
            {isPayer ? 'You paid' : 'Your share'}
          </Typography>
          <Typography
            variant="body1"
            weight="bold"
            className={isPayer && isOwed ? 'text-success-600' : owes ? 'text-accent-600' : 'text-muted-900'}
          >
            {isPayer && isOwed ? '+' : owes ? '-' : ''}${userAmount.toFixed(2)}
          </Typography>
        </div>
      </div>

      {/* Paid by section */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Avatar src={paidBy.avatar} alt={paidBy.name} size="sm" />
          <div>
            <Typography variant="caption" className="text-muted-500">
              Paid by
            </Typography>
            <Typography variant="body2" weight="medium" className="text-muted-900">
              {isPayer ? 'You' : paidBy.name}
            </Typography>
          </div>
        </div>

        {/* Owed/Owing indicator */}
        {status !== 'settled' && (
          <div className={`px-3 py-1.5 rounded-lg ${isOwed ? 'bg-success-50' : owes ? 'bg-accent-50' : 'bg-muted-50'}`}>
            <Typography
              variant="body2"
              weight="semibold"
              className={isOwed ? 'text-success-600' : owes ? 'text-accent-600' : 'text-muted-600'}
            >
              {isOwed ? `You're owed $${totalOwed.toFixed(2)}` : owes ? `You owe $${totalOwed.toFixed(2)}` : 'Settled'}
            </Typography>
          </div>
        )}
      </div>

      {/* Participants */}
      {shares.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <Typography variant="caption" className="text-muted-500">
            Split between:
          </Typography>
          <div className="flex -space-x-2">
            {shares.slice(0, 4).map((share) => (
              <Avatar
                key={share.userId}
                src={share.userAvatar}
                alt={share.userName}
                size="xs"
                className="ring-2 ring-white"
              />
            ))}
            {shares.length > 4 && (
              <div className="w-6 h-6 rounded-full bg-muted-200 border-2 border-white flex items-center justify-center">
                <Typography variant="caption" className="text-muted-600 text-[10px]">
                  +{shares.length - 4}
                </Typography>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {status !== 'settled' && (
        <div className="flex gap-2 pt-3 border-t border-muted-100">
          {!isPayer && owes && onSettle && (
            <Button
              variant="success"
              size="sm"
              icon={<Icon name="settle" size={16} />}
              onClick={(e) => {
                e?.stopPropagation();
                onSettle();
              }}
              className="flex-1"
            >
              Settle Up
            </Button>
          )}
          
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon name="edit" size={16} />}
              onClick={(e) => {
                e?.stopPropagation();
                onEdit();
              }}
            >
              Edit
            </Button>
          )}
          
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon name="delete" size={16} />}
              onClick={(e) => {
                e?.stopPropagation();
                onDelete();
              }}
              className="text-accent-600 hover:bg-accent-50"
            >
              Delete
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default ExpenseItem;