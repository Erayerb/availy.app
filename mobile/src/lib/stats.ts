import type { Venue } from './api';
import { distanceKm } from './geo.ts';

export type HourRatio = { hour: number; ratio: number };

// Ignore the night when picking the quietest hour (venues are mostly closed)
const OPEN_FROM = 8;

export const DEAD_HOUR_MAX_RATIO = 0.4;
export const isDeadHour = (ratio: number) => ratio < DEAD_HOUR_MAX_RATIO;

export const formatHour = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

export function summarizeDay(hours: HourRatio[]) {
  const open = hours.filter((h) => h.hour >= OPEN_FROM);
  const quietest = open.reduce((a, b) => (b.ratio < a.ratio ? b : a));
  const busiest = open.reduce((a, b) => (b.ratio > a.ratio ? b : a));
  return { quietest, busiest };
}

/** Similar venues nearby (same category or a shared purpose tag), nearest first. */
export function nearbyCompetitors(venue: Venue, all: Venue[], maxKm = 2, limit = 3) {
  return all
    .filter((v) => v.id !== venue.id)
    .filter((v) => v.category === venue.category || v.tags.some((t) => venue.tags.includes(t)))
    .map((v) => ({ venue: v, distanceKm: distanceKm(venue, v) }))
    .filter((c) => c.distanceKm <= maxKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

export const percent = (ratio: number) => `%${Math.round(ratio * 100)}`;
