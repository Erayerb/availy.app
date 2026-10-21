/** v2: the venue the user is standing at, for "İlk check-in'in" right after sign-up. */
import type { Venue } from './api';
import { distanceKm, type LatLon } from './geo.ts';

// Same as the server. TEMPORARY: 1 km for trying the app; back to 0.15 before the release
export const CHECKIN_RADIUS_KM = 1;

/** Small box around a point, as the API's bbox ("minLon,minLat,maxLon,maxLat"). */
export function bboxAround({ lat, lon }: LatLon, delta = 0.004): string {
  return [lon - delta, lat - delta, lon + delta, lat + delta].map((n) => n.toFixed(5)).join(',');
}

/** Nearest open venue within check-in distance (or `radiusKm`), or null. */
export function nearestOpenVenue<T extends Pick<Venue, 'lat' | 'lon' | 'open_now'>>(
  venues: T[],
  at: LatLon,
  radiusKm = CHECKIN_RADIUS_KM,
): T | null {
  let best: { venue: T; km: number } | null = null;
  for (const venue of venues) {
    if (!venue.open_now) continue;
    const km = distanceKm(at, venue);
    if (km <= radiusKm && (!best || km < best.km)) best = { venue, km };
  }
  return best?.venue ?? null;
}
