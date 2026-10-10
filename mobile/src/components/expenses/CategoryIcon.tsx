// src/screens/expenses/CategoryIcon.tsx (same icons as web/src/components/expenses/CategoryIcon.tsx)
import React from 'react';
import { View } from 'react-native';
import {
  Bus, Gift, HeartPulse, Home, Lightbulb, LucideIcon, Plane, Popcorn, Receipt, ShoppingBag, ShoppingCart, Sparkles, UtensilsCrossed, Wine,
} from 'lucide-react-native';
import { colors } from '../../theme';

const ICONS: Record<string, LucideIcon> = {
  groceries: ShoppingCart, food: UtensilsCrossed, drinks: Wine, transport: Bus, travel: Plane, rent: Home,
  utilities: Lightbulb, household: Sparkles, entertainment: Popcorn, shopping: ShoppingBag, health: HeartPulse, gifts: Gift, other: Receipt,
};

export const categoryIconFor = (category: string): LucideIcon => ICONS[category] || Receipt;

const CategoryIcon: React.FC<{ category: string; size?: number; bare?: boolean; color?: string }> = ({ category, size = 40, bare, color }) => {
  const Icon = categoryIconFor(category);
  if (bare) return <Icon size={16} color={color || colors.primary700} strokeWidth={1.75} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary50, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={size * 0.5} color={colors.primary700} strokeWidth={1.75} />
    </View>
  );
};

export default CategoryIcon;
