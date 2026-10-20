/** v2: the venue the user is standing at, for "İlk check-in'in" right after sign-up. */
import type { Venue } from './api';
import { distanceKm, type LatLon } from './geo.ts';

export const CHECKIN_RADIUS_KM = 0.15; // same as the server

/** Small box around a point, as the API's bbox ("minLon,minLat,maxLon,maxLat"). */
export function bboxAround({ lat, lon }: LatLon, delta = 0.004): string {
  return [lon - delta, lat - delta, lon + delta, lat + delta].map((n) => n.toFixed(5)).join(',');
}

/** Nearest open venue within check-in distance, or null. */
export function nearestOpenVenue<T extends Pick<Venue, 'lat' | 'lon' | 'open_now'>>(venues: T[], at: LatLon): T | null {
  let best: { venue: T; km: number } | null = null;
  for (const venue of venues) {
    if (!venue.open_now) continue;
    const km = distanceKm(at, venue);
    if (km <= CHECKIN_RADIUS_KM && (!best || km < best.km)) best = { venue, km };
  }
  return best?.venue ?? null;
}
