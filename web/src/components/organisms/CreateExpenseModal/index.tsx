// src/components/organisms/CreateExpenseModal.tsx
import React, { useState, useMemo } from 'react';
import { Button, Input, Textarea, Typography } from '../../atoms';
import Icon from '../../atoms/Icon';
import { UserCard } from '../../molecules';

interface User {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
}

interface CreateExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateExpense: (data: {
    description: string;
    amount: number;
    category: string;
    paidById: string;
    splitType: 'equal' | 'percentage' | 'custom';
    shares: Record<string, number>; // userId -> amount
  }) => void;
  groupMembers: User[];
  currentUserId: string;
  isLoading?: boolean;
}

const CreateExpenseModal: React.FC<CreateExpenseModalProps> = ({
  isOpen,
  onClose,
  onCreateExpense,
  groupMembers,
  currentUserId,
  isLoading = false
}) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [paidById, setPaidById] = useState(currentUserId);
  const [splitType, setSplitType] = useState<'equal' | 'percentage' | 'custom'>('equal');
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([currentUserId]);

  const [errors, setErrors] = useState<{
    description?: string;
    amount?: string;
    members?: string;
    shares?: string;
  }>({});

  const categories = [
    { id: 'food', label: 'Food & Drinks', icon: '🍕' },
    { id: 'transport', label: 'Transport', icon: '🚗' },
    { id: 'entertainment', label: 'Entertainment', icon: '🎬' },
    { id: 'shopping', label: 'Shopping', icon: '🛍️' },
    { id: 'utilities', label: 'Utilities', icon: '💡' },
    { id: 'other', label: 'Other', icon: '📝' }
  ];

  const toggleMember = (userId: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
    setErrors(prev => ({ ...prev, members: undefined }));
  };

  // Calculate shares - MOVED BEFORE early return
  const calculatedShares = useMemo(() => {
    const totalAmount = parseFloat(amount) || 0;
    const shares: Record<string, number> = {};

    if (splitType === 'equal') {
      const perPerson = totalAmount / selectedMemberIds.length;
      selectedMemberIds.forEach(id => {
        shares[id] = perPerson;
      });
    } else if (splitType === 'custom') {
      selectedMemberIds.forEach(id => {
        const customAmount = parseFloat(customShares[id] || '0');
        shares[id] = customAmount;
      });
    }

    return shares;
  }, [amount, splitType, selectedMemberIds, customShares]);

  // Validate shares - MOVED BEFORE early return
  const totalCustomShares = useMemo(() => {
    return Object.values(calculatedShares).reduce((sum, val) => sum + val, 0);
  }, [calculatedShares]);

  // NOW do the early return AFTER all hooks
  if (!isOpen) return null;

  const handleCreate = () => {
    const newErrors: typeof errors = {};

    // Validate description
    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      newErrors.amount = 'Enter a valid amount greater than 0';
    }

    // Validate members
    if (selectedMemberIds.length < 2) {
      newErrors.members = 'Select at least 2 members (including yourself)';
    }

    // Validate custom shares
    if (splitType === 'custom') {
      const diff = Math.abs(totalCustomShares - amountNum);
      if (diff > 0.01) {
        newErrors.shares = `Shares must add up to $${amountNum.toFixed(2)}. Currently: $${totalCustomShares.toFixed(2)}`;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onCreateExpense({
      description: description.trim(),
      amount: amountNum,
      category,
      paidById,
      splitType,
      shares: calculatedShares
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-elevated max-w-2xl w-full max-h-[90vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-muted-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-600 to-accent-500 flex items-center justify-center">
              <Icon name="dollar" size={22} className="text-white" />
            </div>
            <div>
              <Typography variant="h5" weight="bold" className="text-muted-900">
                Add Expense
              </Typography>
              <Typography variant="caption" className="text-muted-500">
                Split an expense with the group
              </Typography>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon name="close" size={20} />}
            onClick={onClose}
            disabled={isLoading}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Description */}
          <Input
            label="Description"
            placeholder="What's this expense for?"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setErrors(prev => ({ ...prev, description: undefined }));
            }}
            error={errors.description}
            required
            disabled={isLoading}
          />

          {/* Amount */}
          <Input
            label="Total Amount"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setErrors(prev => ({ ...prev, amount: undefined }));
            }}
            leftIcon={<Icon name="dollar" size={18} />}
            error={errors.amount}
            required
            disabled={isLoading}
          />

          {/* Category */}
          <div>
            <Typography variant="label" className="text-muted-700 mb-2">
              Category
            </Typography>
            <div className="grid grid-cols-3 gap-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  disabled={isLoading}
                  className={`
                    flex flex-col items-center gap-2 p-3 rounded-xl
                    border-2 transition-all
                    ${category === cat.id
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-muted-200 hover:border-primary-300 text-muted-600'
                    }
                  `}
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <Typography variant="caption" weight="medium">
                    {cat.label}
                  </Typography>
                </button>
              ))}
            </div>
          </div>

          {/* Paid by */}
          <div>
            <Typography variant="label" className="text-muted-700 mb-2">
              Paid by
            </Typography>
            <div className="space-y-2">
              {groupMembers.map(member => (
                <button
                  key={member.id}
                  onClick={() => setPaidById(member.id)}
                  disabled={isLoading}
                  className={`
                    w-full flex items-center gap-3 p-3 rounded-xl
                    border-2 transition-all
                    ${paidById === member.id
                      ? 'border-success-600 bg-success-50'
                      : 'border-muted-200 hover:border-success-300'
                    }
                  `}
                >
                  <div className={`
                    w-5 h-5 rounded-full border-2 flex items-center justify-center
                    ${paidById === member.id ? 'border-success-600 bg-success-600' : 'border-muted-300'}
                  `}>
                    {paidById === member.id && <Icon name="check" size={12} className="text-white" />}
                  </div>
                  <Typography variant="body2" weight="medium" className="text-muted-900">
                    {member.name} {member.id === currentUserId && '(You)'}
                  </Typography>
                </button>
              ))}
            </div>
          </div>

          {/* Split type */}
          <div>
            <Typography variant="label" className="text-muted-700 mb-2">
              Split Type
            </Typography>
            <div className="flex gap-2">
              <button
                onClick={() => setSplitType('equal')}
                disabled={isLoading}
                className={`
                  flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-all
                  ${splitType === 'equal'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-muted-100 text-muted-600 hover:bg-muted-200'
                  }
                `}
              >
                Equal
              </button>
              <button
                onClick={() => setSplitType('custom')}
                disabled={isLoading}
                className={`
                  flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-all
                  ${splitType === 'custom'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-muted-100 text-muted-600 hover:bg-muted-200'
                  }
                `}
              >
                Custom
              </button>
            </div>
          </div>

          {/* Split with */}
          <div>
            <Typography variant="label" className="text-muted-700 mb-2">
              Split with {selectedMemberIds.length > 0 && `(${selectedMemberIds.length} selected)`}
            </Typography>
            {errors.members && (
              <div className="mb-2 p-2 bg-accent-50 border border-accent-200 rounded-lg">
                <Typography variant="caption" className="text-accent-700">
                  {errors.members}
                </Typography>
              </div>
            )}
            <div className="space-y-2">
              {groupMembers.map(member => (
                <div key={member.id} className="flex items-center gap-3">
                  <button
                    onClick={() => toggleMember(member.id)}
                    disabled={isLoading}
                    className={`
                      flex-1 flex items-center gap-3 p-3 rounded-xl
                      border-2 transition-all
                      ${selectedMemberIds.includes(member.id)
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-muted-200 hover:border-primary-300'
                      }
                    `}
                  >
                    <div className={`
                      w-5 h-5 rounded border-2 flex items-center justify-center
                      ${selectedMemberIds.includes(member.id) ? 'border-primary-600 bg-primary-600' : 'border-muted-300'}
                    `}>
                      {selectedMemberIds.includes(member.id) && <Icon name="check" size={12} className="text-white" />}
                    </div>
                    <Typography variant="body2" weight="medium" className="text-muted-900 flex-1 text-left">
                      {member.name} {member.id === currentUserId && '(You)'}
                    </Typography>
                    <Typography variant="body2" weight="semibold" className="text-primary-600">
                      ${selectedMemberIds.includes(member.id) ? calculatedShares[member.id]?.toFixed(2) || '0.00' : '0.00'}
                    </Typography>
                  </button>

                  {/* Custom amount input */}
                  {splitType === 'custom' && selectedMemberIds.includes(member.id) && (
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={customShares[member.id] || ''}
                      onChange={(e) => {
                        setCustomShares(prev => ({ ...prev, [member.id]: e.target.value }));
                        setErrors(prev => ({ ...prev, shares: undefined }));
                      }}
                      className="w-24"
                      disabled={isLoading}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Custom shares validation */}
          {splitType === 'custom' && errors.shares && (
            <div className="p-3 bg-accent-50 border border-accent-200 rounded-lg">
              <Typography variant="body2" className="text-accent-700">
                {errors.shares}
              </Typography>
            </div>
          )}

          {/* Summary */}
          {amount && selectedMemberIds.length > 0 && (
            <div className="p-4 bg-muted-50 rounded-xl">
              <Typography variant="body2" weight="semibold" className="text-muted-900 mb-2">
                Split Summary
              </Typography>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <Typography variant="body2" className="text-muted-600">Total:</Typography>
                  <Typography variant="body2" weight="semibold" className="text-muted-900">
                    ${parseFloat(amount || '0').toFixed(2)}
                  </Typography>
                </div>
                <div className="flex justify-between text-sm">
                  <Typography variant="body2" className="text-muted-600">Per person (equal):</Typography>
                  <Typography variant="body2" weight="semibold" className="text-muted-900">
                    ${(parseFloat(amount || '0') / selectedMemberIds.length).toFixed(2)}
                  </Typography>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-muted-200">
          <Button
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          
          <Button
            variant="primary"
            size="md"
            onClick={handleCreate}
            loading={isLoading}
            disabled={isLoading}
          >
            Create Expense
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateExpenseModal;