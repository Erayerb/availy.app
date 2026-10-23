import type { Venue } from './api';
import { crowdScore } from './crowd.ts';
import { sortByDistance, type LatLon } from './geo.ts';

export type SortMode = 'recommended' | 'nearest' | 'quietest';

export const SORT_OPTIONS: { mode: SortMode; label: string }[] = [
  { mode: 'recommended', label: 'Önerilen' },
  { mode: 'nearest', label: 'En yakın' },
  { mode: 'quietest', label: 'En sakin' },
];

/** Open venues first, emptiest (by fresh check-ins) first; no fresh data next, closed ones last. */
export function byQuietest(venues: Venue[]): Venue[] {
  return [...venues].sort((a, b) => {
    const open = Number(b.open_now) - Number(a.open_now);
    if (open !== 0) return open;
    const [sa, sb] = [crowdScore(a), crowdScore(b)];
    return sa === sb ? 0 : sa < sb ? -1 : 1;
  });
}

export function sortVenues(
  venues: Venue[],
  mode: SortMode,
  point: LatLon | null,
  recommended: (v: Venue[]) => Venue[],
) {
  if (mode === 'nearest' && point) return sortByDistance(venues, point);
  if (mode === 'quietest') return byQuietest(venues);
  return recommended(venues);
}

// "Trendler" on the map: the venues most people checked in at in the last 24 hours
export const TRENDING_LIMIT = 20;

export function trending<T extends { trend?: number }>(venues: T[]): T[] {
  return venues
    .filter((v) => (v.trend ?? 0) > 0)
    .sort((a, b) => (b.trend ?? 0) - (a.trend ?? 0))
    .slice(0, TRENDING_LIMIT);
}
