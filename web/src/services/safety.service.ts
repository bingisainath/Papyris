// src/services/safety.service.ts
// Blocking people, reporting abuse, and (app admins) reviewing reports.
import api from '../utils/axios';

const V1 = '/api/v1';
const data = <T>(promise: Promise<{ data: { data: T } }>) => promise.then(r => r.data.data);

export type ReportReason = 'spam' | 'harassment' | 'scam' | 'inappropriate' | 'impersonation' | 'other';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam or unwanted messages' },
  { value: 'scam', label: 'Scam or fraud (money, links, fake requests)' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'inappropriate', label: 'Inappropriate or offensive content' },
  { value: 'impersonation', label: 'Pretending to be someone else' },
  { value: 'other', label: 'Something else' },
];

export interface BlockedPerson { id: string; username: string; name: string | null; avatar: string | null; blocked_at: string }

export interface ReportView {
  id: string;
  reason: ReportReason;
  details: string | null;
  evidence: string | null;
  status: 'open' | 'resolved';
  reporter: { id: string; username: string; name: string | null } | null;
  reported_user: { id: string; username: string; name: string | null; avatar: string | null } | null;
  times_reported: number;
  conversation: { id: string; kind: string; title: string | null } | null;
  message_id: string | null;
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
}

export const safetyService = {
  blocked: () => data<BlockedPerson[]>(api.get(`${V1}/users/blocked`)),
  block: (userId: string) => data(api.post(`${V1}/users/${userId}/block`)),
  unblock: (userId: string) => data(api.delete(`${V1}/users/${userId}/block`)),
  report: (body: {
    user_id?: string; conversation_id?: string; message_id?: string; reason: ReportReason;
    details?: string; evidence?: string; block?: boolean;
  }) => data<{ reported: boolean; blocked: boolean }>(api.post(`${V1}/reports`, body)),
  reports: (status: 'open' | 'resolved' = 'open') => data<ReportView[]>(api.get(`${V1}/admin/reports`, { params: { status } })),
  resolve: (id: string, resolution: string) => data(api.post(`${V1}/admin/reports/${id}/resolve`, { resolution })),
};
