/** v2: a person's profile, block / mute, and reporting reviews or replies. */
import { send } from './accountApi.ts';
import type { Badge } from './auth.ts';

export type ProfileVenue = {
  venue_id: number;
  venue_name: string;
  category: string;
  visits: number;
  last_at: string;
  discovered: boolean;
};

export type Profile = {
  id: number;
  username: string;
  relation: 'self' | 'friend' | 'outgoing' | 'incoming' | 'none';
  muted: boolean;
  points: number;
  checkins: number;
  discoveries: number;
  badges: Badge[];
  venues: ProfileVenue[] | null; // null: only friends see them
  weekly_streak?: number; // "🔥 4 haftalık seri"
};

export type ReportReason = 'insult' | 'spam' | 'false' | 'other';
export const REPORT_REASONS: { reason: ReportReason; label: string }[] = [
  { reason: 'insult', label: 'Hakaret / taciz' },
  { reason: 'spam', label: 'Spam / reklam' },
  { reason: 'false', label: 'Yanlış bilgi' },
  { reason: 'other', label: 'Diğer' },
];

const user = (username: string) => `/v1/users/${encodeURIComponent(username)}`;

export const safetyApi = {
  profile: (token: string, username: string) => send<Profile>('GET', user(username), undefined, token),
  block: (token: string, username: string) => send<void>('POST', `${user(username)}/block`, undefined, token),
  unblock: (token: string, username: string) => send<void>('DELETE', `${user(username)}/block`, undefined, token),
  mute: (token: string, username: string, on: boolean) =>
    send<void>(on ? 'POST' : 'DELETE', `${user(username)}/mute`, undefined, token),
  blocked: (token: string) => send<{ username: string; created_at: string }[]>('GET', '/v1/me/blocked', undefined, token),
  reportReview: (token: string, id: number, reason: ReportReason) =>
    send<void>('POST', `/v1/reviews/${id}/report`, { reason }, token),
  reportReply: (token: string, id: number, reason: ReportReason) =>
    send<void>('POST', `/v1/replies/${id}/report`, { reason }, token),
};

/** Venues a person made the first check-in at, and all venues they checked in at. */
export function splitVenues(venues: ProfileVenue[]): { discovered: ProfileVenue[]; visited: ProfileVenue[] } {
  return { discovered: venues.filter((v) => v.discovered), visited: venues };
}
