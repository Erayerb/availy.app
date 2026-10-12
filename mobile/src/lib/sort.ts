import type { Venue } from './api';
import { sortByDistance, type LatLon } from './geo.ts';

export type SortMode = 'recommended' | 'nearest' | 'quietest';

export const SORT_OPTIONS: { mode: SortMode; label: string }[] = [
  { mode: 'recommended', label: 'Önerilen' },
  { mode: 'nearest', label: 'En yakın' },
  { mode: 'quietest', label: 'En sakin' },
];

/** Open venues first, emptiest first; closed ones at the end. */
export function byQuietest(venues: Venue[]): Venue[] {
  return [...venues].sort(
    (a, b) => Number(b.open_now) - Number(a.open_now) || a.occupancy.ratio - b.occupancy.ratio,
  );
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
