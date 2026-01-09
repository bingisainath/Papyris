// src/components/organisms/ExpensePanel.tsx
import React, { useState, useMemo } from 'react';
import { Button, Input, Typography, Loading } from '../../atoms';
import Icon from '../../atoms/Icon';
import { ExpenseItem, BalanceSummary } from '../../molecules';

interface Expense {
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
  status: 'pending' | 'settled' | 'partial';
  splitType?: 'equal' | 'percentage' | 'custom';
  shares: Array<{
    userId: string;
    userName: string;
    userAvatar?: string;
    amount: number;
    paid?: boolean;
  }>;
}

interface ExpensePanelProps {
  expenses: Expense[];
  currentUserId: string;
  totalOwed: number;
  totalOwe: number;
  totalSettled: number;
  onCreateExpense?: () => void;
  onSettleExpense?: (expenseId: string) => void;
  onEditExpense?: (expenseId: string) => void;
  onDeleteExpense?: (expenseId: string) => void;
  onViewExpense?: (expenseId: string) => void;
  isLoading?: boolean;
  className?: string;
}

const ExpensePanel: React.FC<ExpensePanelProps> = ({
  expenses,
  currentUserId,
  totalOwed,
  totalOwe,
  totalSettled,
  onCreateExpense,
  onSettleExpense,
  onEditExpense,
  onDeleteExpense,
  onViewExpense,
  isLoading = false,
  className = ''
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'settled' | 'youOwe' | 'youAreOwed'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');

  // Filter and sort expenses
  const filteredExpenses = useMemo(() => {
    // Safety check: default to empty array if expenses is undefined/null
    if (!expenses || !Array.isArray(expenses)) {
      return [];
    }

    let filtered = [...expenses]; // Create a copy to avoid mutating original

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.description.toLowerCase().includes(query) ||
        e.paidBy.name.toLowerCase().includes(query) ||
        e.category?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filter === 'pending') {
      filtered = filtered.filter(e => e.status === 'pending');
    } else if (filter === 'settled') {
      filtered = filtered.filter(e => e.status === 'settled');
    } else if (filter === 'youOwe') {
      filtered = filtered.filter(e => {
        const userShare = e.shares.find(s => s.userId === currentUserId);
        return e.paidBy.id !== currentUserId && !userShare?.paid;
      });
    } else if (filter === 'youAreOwed') {
      filtered = filtered.filter(e => {
        return e.paidBy.id === currentUserId && e.status !== 'settled';
      });
    }

    // Sort
    if (sortBy === 'date') {
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else if (sortBy === 'amount') {
      filtered.sort((a, b) => b.totalAmount - a.totalAmount);
    }

    return filtered;
  }, [expenses, searchQuery, filter, sortBy, currentUserId]);

  // Calculate stats
  const stats = useMemo(() => {
    // Safety check
    if (!expenses || !Array.isArray(expenses)) {
      return {
        total: 0,
        pending: 0,
        settled: 0,
        youOwe: 0,
        youAreOwed: 0
      };
    }

    return {
      total: expenses.length,
      pending: expenses.filter(e => e.status === 'pending').length,
      settled: expenses.filter(e => e.status === 'settled').length,
      youOwe: expenses.filter(e => {
        const userShare = e.shares.find(s => s.userId === currentUserId);
        return e.paidBy.id !== currentUserId && !userShare?.paid;
      }).length,
      youAreOwed: expenses.filter(e => 
        e.paidBy.id === currentUserId && e.status !== 'settled'
      ).length
    };
  }, [expenses, currentUserId]);

  return (
    <div className={`flex flex-col h-full bg-gradient-to-br from-muted-50 to-accent-50/20 ${className}`}>
      {/* Header */}
      <div className="px-6 py-5 border-b border-muted-200 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center shadow-card">
              <Icon name="dollar" size={24} className="text-white" />
            </div>
            <div>
              <Typography variant="h4" weight="bold" className="text-muted-900">
                Expenses
              </Typography>
              <Typography variant="caption" className="text-muted-500">
                Track and split expenses
              </Typography>
            </div>
          </div>
          {onCreateExpense && (
            <Button
              variant="primary"
              size="md"
              icon={<Icon name="plus" size={20} />}
              onClick={onCreateExpense}
            >
              Add Expense
            </Button>
          )}
        </div>
      </div>

      {/* Balance Summary */}
      <div className="px-6 py-5 border-b border-muted-200">
        <BalanceSummary
          totalOwed={totalOwed}
          totalOwe={totalOwe}
          totalSettled={totalSettled}
          variant="default"
        />
      </div>

      {/* Filters and Search */}
      <div className="px-6 py-4 border-b border-muted-200 bg-white/50">
        {/* Search */}
        <Input
          type="search"
          placeholder="Search expenses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Icon name="search" size={18} />}
          className="mb-3"
        />

        {/* Filter buttons */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
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
            onClick={() => setFilter('youOwe')}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${filter === 'youOwe' 
                ? 'bg-accent-600 text-white shadow-sm' 
                : 'bg-accent-50 text-accent-600 hover:bg-accent-100'
              }
            `}
          >
            You Owe ({stats.youOwe})
          </button>
          <button
            onClick={() => setFilter('youAreOwed')}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${filter === 'youAreOwed' 
                ? 'bg-success-600 text-white shadow-sm' 
                : 'bg-success-50 text-success-600 hover:bg-success-100'
              }
            `}
          >
            You're Owed ({stats.youAreOwed})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${filter === 'pending' 
                ? 'bg-yellow-600 text-white shadow-sm' 
                : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
              }
            `}
          >
            Pending ({stats.pending})
          </button>
          <button
            onClick={() => setFilter('settled')}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${filter === 'settled' 
                ? 'bg-muted-600 text-white shadow-sm' 
                : 'bg-muted-100 text-muted-600 hover:bg-muted-200'
              }
            `}
          >
            Settled ({stats.settled})
          </button>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <Typography variant="caption" className="text-muted-500">
            Sort by:
          </Typography>
          <button
            onClick={() => setSortBy('date')}
            className={`
              px-2 py-1 rounded text-xs font-medium transition-all
              ${sortBy === 'date' 
                ? 'text-primary-600 underline' 
                : 'text-muted-600 hover:text-primary-600'
              }
            `}
          >
            Date
          </button>
          <span className="text-muted-300">•</span>
          <button
            onClick={() => setSortBy('amount')}
            className={`
              px-2 py-1 rounded text-xs font-medium transition-all
              ${sortBy === 'amount' 
                ? 'text-primary-600 underline' 
                : 'text-muted-600 hover:text-primary-600'
              }
            `}
          >
            Amount
          </button>
        </div>
      </div>

      {/* Expense list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loading variant="dots" size="lg" text="Loading expenses..." />
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            {searchQuery || filter !== 'all' ? (
              <>
                <div className="w-20 h-20 mb-4 rounded-full bg-muted-100 flex items-center justify-center">
                  <Icon name="search" size={32} className="text-muted-400" />
                </div>
                <Typography variant="h6" weight="semibold" className="text-muted-900 mb-2">
                  No expenses found
                </Typography>
                <Typography variant="body2" className="text-muted-500 max-w-xs">
                  Try adjusting your filters or search terms
                </Typography>
              </>
            ) : (
              <>
                <div className="w-20 h-20 mb-4 rounded-full bg-gradient-to-br from-accent-100 to-accent-200 flex items-center justify-center">
                  <Icon name="receipt" size={32} className="text-accent-600" />
                </div>
                <Typography variant="h6" weight="semibold" className="text-muted-900 mb-2">
                  No expenses yet
                </Typography>
                <Typography variant="body2" className="text-muted-500 max-w-xs mb-4">
                  Start tracking expenses by creating your first one
                </Typography>
                {onCreateExpense && (
                  <Button
                    variant="primary"
                    size="md"
                    icon={<Icon name="plus" size={18} />}
                    onClick={onCreateExpense}
                  >
                    Add Your First Expense
                  </Button>
                )}
              </>
            )}
          </div>
        ) : (
          filteredExpenses.map((expense) => (
            <ExpenseItem
              key={expense.id}
              {...expense}
              currentUserId={currentUserId}
              onSettle={onSettleExpense ? () => onSettleExpense(expense.id) : undefined}
              onEdit={onEditExpense ? () => onEditExpense(expense.id) : undefined}
              onDelete={onDeleteExpense ? () => onDeleteExpense(expense.id) : undefined}
              onClick={onViewExpense ? () => onViewExpense(expense.id) : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ExpensePanel;