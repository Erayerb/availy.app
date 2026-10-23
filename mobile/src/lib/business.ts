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
  // username is null for a private check-in; reward is what the business already sent
  discovered_by: { username: string | null; at: string; can_reward: boolean; reward: string | null } | null;
  // Müşteriler (anonymous): different people and regulars (3+ check-ins) in 30 days, the top visit counts
  month_people: number;
  regulars: number;
  top_visits: number[];
};

export const MAX_REWARD = 120;

export const WEEKDAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export const businessApi = {
  stats: (token: string, venueId: number) => send<VenueStats>('GET', `/v1/venues/${venueId}/stats`, undefined, token),
  // "Ödül ver": once per venue, the discoverer gets it as a notification
  rewardDiscoverer: (token: string, venueId: number, message: string) =>
    send<{ message: string }>('POST', `/v1/venues/${venueId}/discoverer-reward`, { message }, token),
};

/** "En çok check-in 14:00'te" — the busiest hour today, or null without check-ins. */
export function busiestHour(today: HourStat[]): number | null {
  const best = today.reduce<HourStat | null>((a, h) => (h.checkins > (a?.checkins ?? 0) ? h : a), null);
  return best ? best.hour : null;
}

/** The one weekday with the fewest check-ins; null when several days share the lowest count. */
export function quietestWeekday(weekday: number[]): number | null {
  const min = Math.min(...weekday);
  return weekday.filter((n) => n === min).length === 1 ? weekday.indexOf(min) : null;
}
