/**
 * Expected occupancy for the coming hours. Lets the app schedule "it emptied"
 * and dead-hour notifications that fire while it is closed. With fake data the
 * future is known exactly; with real data this becomes a prediction.
 */
import { BUCKET_SECONDS, dummyOccupancy } from './dummyOccupancy.ts';
import { isOpenAtHour, istanbulHour } from './hours.ts';

export type ForecastPoint = { at: string; ratio: number; open: boolean };

export const FORECAST_HOURS = 12;

/** Same steps as the backend's /forecast, computed on the phone (web demo, venues added on this phone). */
export function localForecast(
  venueId: number,
  popularity: number,
  alwaysBusy: boolean,
  opening: [number, number],
  now = new Date(),
  hours = FORECAST_HOURS,
): ForecastPoint[] {
  const first = (Math.floor(now.getTime() / 1000 / BUCKET_SECONDS) + 1) * BUCKET_SECONDS;
  return Array.from({ length: (hours * 3600) / BUCKET_SECONDS }, (_, i) => {
    const at = new Date((first + i * BUCKET_SECONDS) * 1000);
    return {
      at: at.toISOString(),
      ratio: dummyOccupancy(venueId, at, popularity, alwaysBusy).ratio,
      open: isOpenAtHour(opening, istanbulHour(at)),
    };
  });
}

/** Re-apply opening hours the business changed on this phone (the server does not know them yet). */
export const withOpening = (points: ForecastPoint[], opening: [number, number]): ForecastPoint[] =>
  points.map((p) => ({ ...p, open: isOpenAtHour(opening, istanbulHour(new Date(p.at))) }));

/** First point at or after `notBefore` that passes the test. */
export function firstMatch(
  points: ForecastPoint[],
  test: (p: ForecastPoint) => boolean,
  notBefore: Date,
): ForecastPoint | null {
  return points.find((p) => new Date(p.at).getTime() >= notBefore.getTime() && test(p)) ?? null;
}

// A busy venue counts as emptied once it is below 75% for one 5-minute step
export const EMPTY_THRESHOLD = 0.75;
const QUIET_STEPS = 1;

export type EmptyingEstimate = { kind: 'at'; at: string } | { kind: 'closes' } | { kind: 'none' };

/** When a busy venue is expected to drop below `threshold` (and stay there for a while). */
export function emptyingEstimate(points: ForecastPoint[], threshold: number): EmptyingEstimate {
  for (let i = 0; i < points.length; i++) {
    if (!points[i].open) return { kind: 'closes' };
    const window = points.slice(i, i + QUIET_STEPS);
    if (window.length === QUIET_STEPS && window.every((p) => p.open && p.ratio < threshold)) {
      return { kind: 'at', at: points[i].at };
    }
  }
  return { kind: 'none' };
}

/** "15:20" in Istanbul time. */
export function istanbulTime(iso: string): string {
  const local = new Date(new Date(iso).getTime() + 3 * 3_600_000);
  return `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
}

export function estimateText(estimate: EmptyingEstimate): string {
  if (estimate.kind === 'at') return `Tahmini boşalma: ~${istanbulTime(estimate.at)}`;
  if (estimate.kind === 'closes') return 'Kapanana kadar kalabalık görünüyor';
  return 'Tahmini boşalma belli değil';
}
