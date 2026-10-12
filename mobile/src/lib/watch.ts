/** "Haber ver": tell the user when a busy venue drops below 70%. */
import type { Venue } from './api';

export const WATCH_THRESHOLD = 0.7;

export type Watch = { venueId: number; venueName: string; createdAt: string };

/** Offer the bell only where it makes sense: currently at or above the threshold. */
export const canWatch = (venue: Venue) => venue.occupancy.ratio >= WATCH_THRESHOLD;

export const watchTriggered = (venue: Venue) => venue.open_now && venue.occupancy.ratio < WATCH_THRESHOLD;

export function toggleWatch(watches: Watch[], venue: { id: number; name: string }, now: Date): Watch[] {
  return watches.some((w) => w.venueId === venue.id)
    ? watches.filter((w) => w.venueId !== venue.id)
    : [...watches, { venueId: venue.id, venueName: venue.name, createdAt: now.toISOString() }];
}

export function notificationText(venue: Venue): { title: string; body: string } {
  return {
    title: `${venue.name} boşaldı`,
    body: `Şu an %${Math.round(venue.occupancy.ratio * 100)} dolu. Gitmek için iyi bir zaman.`,
  };
}

export function parseWatches(raw: unknown): Watch[] {
  return Array.isArray(raw) ? raw.filter((w) => w && Number.isInteger(w.venueId)) : [];
}
