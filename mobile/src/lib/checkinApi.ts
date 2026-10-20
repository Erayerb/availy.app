/** v2: sending a check-in (occupancy report + visit) to the server. */
import { send } from './accountApi.ts';
import type { Level } from './occupancy.ts';

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
  visitor_rank: number | null; // "Burayı keşfeden 12. kişisin" (first visit only)
  my_visits: number;
};

export type Visit = { venue_id: number; visits: number; last_at: string };

export const fetchVisits = (token: string) => send<Visit[]>('GET', '/v1/me/visits', undefined, token);

/** Message after a check-in: points, and the explorer note for a venue's first one. */
export function checkinMessage(
  result: Pick<CheckinResult, 'is_first' | 'points_earned' | 'visitor_rank' | 'my_visits'>,
): string {
  const points = `+${result.points_earned} puan`;
  if (result.is_first) return `✨ İlk check-in senin! Burayı sen keşfettin · ${points} · Kâşif rozeti`;
  if (result.visitor_rank !== null) return `✓ Check-in yapıldı · ${points}. Burayı keşfeden ${result.visitor_rank}. kişisin!`;
  return `✓ Check-in yapıldı · ${points}. Buraya ${result.my_visits}. check-in'in.`;
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
