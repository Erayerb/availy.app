import type { Venue } from './api';
import { levelStyle } from './occupancy.ts';

export const WEB_APP_URL = 'https://erayerb.github.io/availy.app/';

/** Link to the web app that opens this venue (by name, which is unique). */
export const venueLink = (name: string) => `${WEB_APP_URL}?venue=${encodeURIComponent(name)}`;

export function shareMessage(venue: Venue): string {
  const status = venue.open_now
    ? `şu an %${Math.round(venue.occupancy.ratio * 100)} dolu (${levelStyle(venue.occupancy.level).label})`
    : `şu an kapalı, ${venue.opens_at}'de açılıyor`;
  return `${venue.name} ${status}. availy'de gör: ${venueLink(venue.name)}`;
}

/** Venue name from a shared link (?venue=...), if any. */
export function venueFromQuery(search: string): string | null {
  const name = new URLSearchParams(search).get('venue');
  return name && name.trim() ? name.trim() : null;
}
