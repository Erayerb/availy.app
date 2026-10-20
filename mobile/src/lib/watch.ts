/** "Sakin olunca haber ver": tell the user when check-ins say a busy venue has become quiet. */
import type { Venue } from './api';
import { liveLevel } from './crowd.ts';

export type Watch = { venueId: number; venueName: string; createdAt: string };

/** Offer the bell where it makes sense: reported Orta or Kalabalık right now. */
export const canWatch = (venue: Venue) => {
  const level = liveLevel(venue);
  return level === 'medium' || level === 'high';
};

export const watchTriggered = (venue: Venue) => liveLevel(venue) === 'low';

export function toggleWatch(watches: Watch[], venue: { id: number; name: string }, now: Date): Watch[] {
  return watches.some((w) => w.venueId === venue.id)
    ? watches.filter((w) => w.venueId !== venue.id)
    : [...watches, { venueId: venue.id, venueName: venue.name, createdAt: now.toISOString() }];
}

export function notificationText(venue: Venue): { title: string; body: string } {
  return {
    title: `${venue.name} sakinleşti`,
    body: 'Son check-in\'lere göre şu an sakin. Gitmek için iyi bir zaman.',
  };
}

export function parseWatches(raw: unknown): Watch[] {
  return Array.isArray(raw) ? raw.filter((w) => w && Number.isInteger(w.venueId)) : [];
}
