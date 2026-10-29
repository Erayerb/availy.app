/** v2: sending a check-in (occupancy report + visit) to the server. */
import { send } from './accountApi.ts';
import type { Level } from './occupancy.ts';
import type { NewBadge } from './badgeEvents.ts';

export type CheckinInput = {
  level: Level;
  queue: boolean | null; // only with "high"
  seats: boolean | null; // only with "medium"
  lat: number;
  lon: number;
  private: boolean; // counts for the occupancy, but the name is never shown
};

export type CheckinResult = {
  id: number;
  venue_id: number;
  level: Level;
  is_first: boolean;
  created_at: string;
  is_private: boolean;
  points_earned: number;
  new_badges?: NewBadge[]; // earned with this check-in: the celebration pop-up
  first_today?: boolean; // the day's first check-in here (not its discovery): double points
  // Why it earned no points: a check-in at another venue in the last 30 minutes, or 8 already today
  points_note?: 'too_soon' | 'daily_limit' | null;
  visitor_rank: number | null; // "Burayı keşfeden 12. kişisin" (first visit only)
  my_visits: number;
  // Coupons of the venue's "Check-in yapana kupon" campaigns, given with this check-in
  coupons?: { code: string; message: string; discount: number | null }[];
  weekly_streak?: number; // weeks in a row with a check-in, this one included
};

export type Visit = { venue_id: number; visits: number; last_at: string };

export const fetchVisits = (token: string) => send<Visit[]>('GET', '/v1/me/visits', undefined, token);

/** Message after a check-in: points, and the explorer note for a venue's first one. */
export function checkinMessage(
  result: Pick<CheckinResult, 'is_first' | 'points_earned' | 'visitor_rank' | 'my_visits' | 'points_note' | 'first_today'>,
): string {
  // Counted for the occupancy, but no points (against farming points in cafes side by side)
  if (result.points_note === 'too_soon') return 'Doluluğa sayıldı · son 30 dakikada başka bir mekanda check-in yaptığın için puan yok';
  if (result.points_note === 'daily_limit') return 'Doluluğa sayıldı · bugünkü puanlı check-in hakkın doldu (günde 8)';
  const points = `+${result.points_earned} puan`;
  // Shown under the "Burayı sen keşfettin!" title, so it does not say it again
  if (result.is_first) return `${points} · Kâşif rozeti kazandın`;
  if (result.first_today) return `${points} · Bugünün ilk bilgisi senden, 2 kat puan!`;
  if (result.visitor_rank !== null) return `${points} · Burayı keşfeden ${result.visitor_rank}. kişisin!`;
  return `${points} · Buraya ${result.my_visits}. check-in'in`;
}

/**
 * "Bugünün ilk bilgisini sen ver": an open venue that was discovered but has no check-in yet today
 * (its last report is from before midnight). Its next check-in earns double points.
 */
export function firstOfDayOpen(venue: { open_now: boolean; crowd?: { last_report_at: string | null } }, now = new Date()): boolean {
  const last = venue.crowd?.last_report_at;
  if (!venue.open_now || !last) return false;
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return new Date(last).getTime() < midnight.getTime();
}

/** Which follow-up question a level gets (Kalabalık: "Sıra var mı?", Orta: "Oturacak yer var mı?"). */
export function followUpQuestion(level: Level | null): { key: 'queue' | 'seats'; text: string } | null {
  if (level === 'high') return { key: 'queue', text: 'Sıra var mı?' };
  if (level === 'medium') return { key: 'seats', text: 'Oturacak yer var mı?' };
  return null;
}

/** Request body: only the answer that belongs to the chosen level is sent. */
export function checkinBody(
  level: Level,
  answer: boolean | null,
  coords: { lat: number; lon: number },
  isPrivate = false,
): CheckinInput {
  const question = followUpQuestion(level);
  return {
    level,
    queue: question?.key === 'queue' ? answer : null,
    seats: question?.key === 'seats' ? answer : null,
    ...coords,
    private: isPrivate,
  };
}

export const sendCheckin = (token: string, venueId: number, input: CheckinInput) =>
  send<CheckinResult>('POST', `/v1/venues/${venueId}/checkins`, input, token);
