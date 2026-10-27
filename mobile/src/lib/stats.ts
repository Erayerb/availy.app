import type { Venue } from './api';
import { distanceKm } from './geo.ts';

export type HourRatio = { hour: number; ratio: number };

// Ignore the night when picking the quietest hour (venues are mostly closed)
const OPEN_FROM = 8;

export const DEAD_HOUR_MAX_RATIO = 0.4;
export const formatHour = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

/** Similar venues nearby (the same kind: a café's are cafés), nearest first. */
export function nearbyCompetitors(venue: Venue, all: Venue[], maxKm = 2, limit = 3) {
  return all
    .filter((v) => v.id !== venue.id && v.category === venue.category)
    .map((v) => ({ venue: v, distanceKm: distanceKm(venue, v) }))
    .filter((c) => c.distanceKm <= maxKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

export const percent = (ratio: number) => `%${Math.round(ratio * 100)}`;
