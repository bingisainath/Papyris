// src/components/expenses/CategoryIcon.tsx
// Line icons for expense categories (no emojis), in the app's purple.

import React from 'react';
import {
  Bus, Gift, HeartPulse, Home, Lightbulb, Plane, Popcorn, Receipt, ShoppingBag, ShoppingCart,
  Sparkles, UtensilsCrossed, Wine,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  groceries: ShoppingCart,
  food: UtensilsCrossed,
  drinks: Wine,
  transport: Bus,
  travel: Plane,
  rent: Home,
  utilities: Lightbulb,
  household: Sparkles,
  entertainment: Popcorn,
  shopping: ShoppingBag,
  health: HeartPulse,
  gifts: Gift,
  other: Receipt,
};

export const categoryIconFor = (category: string): LucideIcon => ICONS[category] || Receipt;

/** Category icon in a soft purple circle (badge) or bare (inline in chips). */
const CategoryIcon: React.FC<{ category: string; size?: 'sm' | 'md' | 'lg'; bare?: boolean; className?: string }> = ({
  category, size = 'md', bare, className = '',
}) => {
  const Icon = categoryIconFor(category);
  const box = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-14 h-14' }[size];
  const glyph = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-7 h-7' }[size];
  if (bare) return <Icon className={`w-4 h-4 ${className}`} strokeWidth={1.75} aria-hidden />;
  return (
    <span className={`inline-flex flex-shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700 ${box} ${className}`}>
      <Icon className={glyph} strokeWidth={1.75} aria-hidden />
    </span>
  );
};

export default CategoryIcon;
