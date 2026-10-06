// src/utils/time.ts
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** Chat list: 14:05 today, "Yesterday", weekday this week, else a short date. */
export function listTime(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  if (sameDay(date, now)) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return 'Yesterday';
  if (now.getTime() - date.getTime() < 6 * 86400000) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export const clockTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Day separators in a chat: Today / Yesterday / 3 October 2026 */
export function dayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (sameDay(date, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
}

/** 75 -> "1:15" */
export const formatDuration = (seconds?: number | null): string => {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export const formatSize = (bytes?: number | null): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};
