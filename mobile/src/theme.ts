// src/theme.ts
// Same calm palette as the web app (web/tailwind.config.js).

export const colors = {
  primary50: '#f6f4fa',
  primary100: '#ece8f5',
  primary200: '#d9d1eb',
  primary300: '#bcaed9',
  primary500: '#7b64aa',
  primary600: '#654e94',
  primary700: '#543f7d',
  primary800: '#443468',
  muted50: '#f8fafc',
  muted100: '#f1f5f9',
  muted200: '#e2e8f0',
  muted300: '#cbd5e1',
  muted400: '#94a3b8',
  muted500: '#64748b',
  muted600: '#475569',
  muted700: '#334155',
  muted900: '#0f172a',
  background: '#f6f6f8',
  white: '#ffffff',
  success600: '#16a34a',
  success700: '#15803d',
  success50: '#f0fdf4',
  danger50: '#fbf3f4',
  danger500: '#b4505f',
  danger600: '#9c3f4e',
  warning50: '#fffbeb',
  warning700: '#b45309',
};

export const radius = { sm: 6, md: 10, lg: 14, xl: 18, full: 999 };
export const space = (n: number) => n * 4;

export const text = {
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.muted900 },
  heading: { fontSize: 17, fontWeight: '600' as const, color: colors.muted900 },
  body: { fontSize: 15, color: colors.muted900 },
  small: { fontSize: 13, color: colors.muted500 },
  tiny: { fontSize: 11, color: colors.muted400 },
};
