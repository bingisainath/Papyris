// src/utils/device.ts
import { Platform } from 'react-native';

/** "Xiaomi 25113PN0EG" / "iPhone", so the other device can show which phone is asking. */
export function phoneName(): string {
  const c = Platform.constants as any;
  if (Platform.OS === 'android') return [c?.Brand && c.Brand[0].toUpperCase() + c.Brand.slice(1), c?.Model].filter(Boolean).join(' ') || 'Android phone';
  return c?.interfaceIdiom === 'pad' ? 'iPad' : 'iPhone';
}
