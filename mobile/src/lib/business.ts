/** v2 business panel: statistics from customers' check-ins. */
import { send } from './accountApi.ts';
import type { Level } from './occupancy.ts';

export type HourStat = { hour: number; checkins: number; level: Level | null };
export type VenueStats = {
  today: HourStat[];
  today_checkins: number;
  week_checkins: number;
  week_people: number;
  week_new: number;
  week_returning: number;
  weekday: number[]; // last 30 days, Monday first
  total_checkins: number;
  discovered_by: { username: string | null; at: string } | null;
};

export const WEEKDAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export const businessApi = {
  stats: (token: string, venueId: number) => send<VenueStats>('GET', `/v1/venues/${venueId}/stats`, undefined, token),
};

/** "En çok check-in 14:00'te" — the busiest hour today, or null without check-ins. */
export function busiestHour(today: HourStat[]): number | null {
  const best = today.reduce<HourStat | null>((a, h) => (h.checkins > (a?.checkins ?? 0) ? h : a), null);
  return best ? best.hour : null;
}

/** The weekday with the fewest check-ins (only when the days differ). */
export function quietestWeekday(weekday: number[]): number | null {
  if (weekday.every((n) => n === weekday[0])) return null;
  return weekday.indexOf(Math.min(...weekday));
}
