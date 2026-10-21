/** v2: leaderboard, notifications and privacy settings on the server. */
import { send } from './accountApi.ts';

export type Period = 'week' | 'all';
export type Scope = 'friends' | 'everyone';
export type RankRow = { rank: number; username: string | null; points: number; me: boolean };
export type Leaderboard = { rows: RankRow[]; me: { rank: number; points: number } | null };

export type AppNotification = {
  kind: 'friend_request' | 'friend_accepted' | 'reply';
  at: string;
  username: string | null;
  venue_id: number | null;
  venue_name: string | null;
  body: string | null;
};

export type Privacy = { share_checkins: boolean; show_in_leaderboard: boolean; searchable: boolean };

export const socialApi = {
  leaderboard: (token: string, period: Period, scope: Scope) =>
    send<Leaderboard>('GET', `/v1/leaderboard?period=${period}&scope=${scope}`, undefined, token),
  notifications: (token: string) => send<AppNotification[]>('GET', '/v1/notifications', undefined, token),
  privacy: (token: string) => send<Privacy & Record<string, unknown>>('GET', '/v1/me', undefined, token),
  setPrivacy: (token: string, patch: Partial<Privacy>) => send<Privacy>('PATCH', '/v1/me/privacy', patch, token),
};

/** Notifications newer than the last time the list was opened. */
export const unreadCount = (items: AppNotification[], lastSeen: string | null) =>
  lastSeen ? items.filter((n) => isAfter(n.at, lastSeen)).length : items.length;

/** Compares times, not text: the server writes "+00:00", the phone "Z". */
export const isAfter = (a: string, b: string) => new Date(a).getTime() > new Date(b).getTime();

/** One line for a notification. */
export function notificationText(n: AppNotification): string {
  const who = n.username ? `@${n.username}` : 'Biri';
  if (n.kind === 'friend_request') return `${who} seni arkadaş olarak eklemek istiyor.`;
  if (n.kind === 'friend_accepted') return `${who} arkadaşlık isteğini kabul etti.`;
  return `${who} yorumunu yanıtladı (${n.venue_name}): "${n.body}"`;
}
