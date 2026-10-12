/** Weekly / monthly statistics: average occupancy during opening hours per day. */
import { hourlyProfile } from './dummyOccupancy.ts';
import { isOpenAtHour } from './hours.ts';

export type History = { daily: { date: string; ratio: number }[]; weekday: number[] };

export const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const DAY_MS = 86_400_000;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Monday = 0 ... Sunday = 6 for a "YYYY-MM-DD" date. */
export const weekdayIndex = (isoDate: string) => (new Date(`${isoDate}T12:00:00Z`).getUTCDay() + 6) % 7;

/** Serverless mirror of GET /v1/venues/{id}/history (static web build and venues added on the phone). */
export function computeHistory(
  venueId: number,
  popularity: number,
  alwaysBusy: boolean,
  hours: [number, number],
  days: number,
  now = new Date(),
): History {
  const openHours = [...Array(24).keys()].filter((h) => isOpenAtHour(hours, h));
  const daily = Array.from({ length: days }, (_, i) => {
    const at = new Date(now.getTime() - (days - 1 - i) * DAY_MS);
    const profile = hourlyProfile(venueId, popularity, at, alwaysBusy);
    const ratios = openHours.map((h) => profile[h].ratio);
    const local = new Date(at.getTime() + 3 * 3_600_000); // Istanbul date
    return {
      date: local.toISOString().slice(0, 10),
      ratio: ratios.length ? round2(ratios.reduce((a, b) => a + b, 0) / ratios.length) : 0,
    };
  });
  const buckets: number[][] = [[], [], [], [], [], [], []];
  for (const d of daily) buckets[weekdayIndex(d.date)].push(d.ratio);
  return { daily, weekday: buckets.map((b) => (b.length ? round2(b.reduce((a, c) => a + c, 0) / b.length) : 0)) };
}

/** Campaign results of one venue over the last `days` days. */
export function campaignTotals(
  campaigns: { id: string; venueId: number; startsAt: string }[],
  views: Record<string, number>,
  coupons: { campaignId: string; redeemedAt: string | null }[],
  venueId: number,
  days: number,
  now = new Date(),
) {
  const since = now.getTime() - days * DAY_MS;
  const ids = new Set(
    campaigns.filter((c) => c.venueId === venueId && new Date(c.startsAt).getTime() >= since).map((c) => c.id),
  );
  const claimed = coupons.filter((c) => ids.has(c.campaignId));
  return {
    campaigns: ids.size,
    views: [...ids].reduce((sum, id) => sum + (views[id] ?? 0), 0),
    claims: claimed.length,
    redemptions: claimed.filter((c) => c.redeemedAt).length,
  };
}
