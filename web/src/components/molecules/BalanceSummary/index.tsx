// src/components/molecules/BalanceSummary.tsx
import React from 'react';
import { Typography } from '../../atoms';
import Icon from '../../atoms/Icon';

interface BalanceSummaryProps {
  totalOwed: number; // Total amount owed to you
  totalOwe: number; // Total amount you owe
  totalSettled: number; // Total settled this month
  variant?: 'default' | 'compact';
  className?: string;
}

const BalanceSummary: React.FC<BalanceSummaryProps> = ({
  totalOwed,
  totalOwe,
  totalSettled,
  variant = 'default',
  className = ''
}) => {
  const netBalance = totalOwed - totalOwe;

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-4 ${className}`}>
        <div className="flex-1 text-center p-3 bg-success-50 rounded-xl">
          <Typography variant="body1" weight="bold" className="text-success-600">
            +${totalOwed.toFixed(2)}
          </Typography>
          <Typography variant="caption" className="text-success-700">
            You're owed
          </Typography>
        </div>

        <div className="flex-1 text-center p-3 bg-accent-50 rounded-xl">
          <Typography variant="body1" weight="bold" className="text-accent-600">
            -${totalOwe.toFixed(2)}
          </Typography>
          <Typography variant="caption" className="text-accent-700">
            You owe
          </Typography>
        </div>

        <div className="flex-1 text-center p-3 bg-muted-50 rounded-xl">
          <Typography variant="body1" weight="bold" className="text-muted-900">
            ${totalSettled.toFixed(2)}
          </Typography>
          <Typography variant="caption" className="text-muted-600">
            Settled
          </Typography>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Net Balance Card */}
      <div
        className={`
          relative overflow-hidden
          p-6 rounded-2xl
          ${netBalance > 0
            ? 'bg-gradient-to-br from-success-500 to-success-600'
            : netBalance < 0
            ? 'bg-gradient-to-br from-accent-500 to-accent-600'
            : 'bg-gradient-to-br from-muted-400 to-muted-500'
          }
          shadow-card
        `}
      >
        {/* Background decoration */}
        <div className="absolute top-0 right-0 opacity-10">
          <Icon name="wallet" size={120} className="text-white" />
        </div>

        <div className="relative">
          <Typography variant="body2" className="text-white/80 mb-1">
            Net Balance
          </Typography>
          <Typography variant="h2" weight="bold" className="text-white mb-2">
            {netBalance >= 0 ? '+' : '-'}${Math.abs(netBalance).toFixed(2)}
          </Typography>
          <Typography variant="body2" className="text-white/90">
            {netBalance > 0
              ? "You're in the positive! 🎉"
              : netBalance < 0
              ? 'You have pending payments'
              : 'All settled up! ✨'}
          </Typography>
        </div>
      </div>

      {/* Detailed breakdown */}
      <div className="grid grid-cols-3 gap-3">
        {/* Amount owed to you */}
        <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-soft border-2 border-success-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-success-100 rounded-lg">
              <Icon name="coins" size={20} className="text-success-600" />
            </div>
          </div>
          <Typography variant="h5" weight="bold" className="text-success-600 mb-1">
            ${totalOwed.toFixed(2)}
          </Typography>
          <Typography variant="caption" className="text-success-700">
            You're owed
          </Typography>
        </div>

        {/* Amount you owe */}
        <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-soft border-2 border-accent-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-accent-100 rounded-lg">
              <Icon name="wallet" size={20} className="text-accent-600" />
            </div>
          </div>
          <Typography variant="h5" weight="bold" className="text-accent-600 mb-1">
            ${totalOwe.toFixed(2)}
          </Typography>
          <Typography variant="caption" className="text-accent-700">
            You owe
          </Typography>
        </div>

        {/* Settled this month */}
        <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-soft border-2 border-muted-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-muted-100 rounded-lg">
              <Icon name="checkCircle" size={20} className="text-muted-600" />
            </div>
          </div>
          <Typography variant="h5" weight="bold" className="text-muted-900 mb-1">
            ${totalSettled.toFixed(2)}
          </Typography>
          <Typography variant="caption" className="text-muted-600">
            Settled
          </Typography>
        </div>
      </div>

      {/* Quick stats */}
      <div className="flex items-center justify-between p-4 bg-white/90 backdrop-blur-sm rounded-xl shadow-soft">
        <div className="flex items-center gap-2">
          <Icon name="info" size={16} className="text-primary-600" />
          <Typography variant="body2" className="text-muted-600">
            {netBalance === 0
              ? 'All expenses are settled'
              : netBalance > 0
              ? `${Math.abs(netBalance).toFixed(2)} will be returned to you`
              : `${Math.abs(netBalance).toFixed(2)} pending to be paid`}
          </Typography>
        </div>
      </div>
    </div>
  );
};

export default BalanceSummary;