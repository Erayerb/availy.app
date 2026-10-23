import demoVenues from '../data/demoVenues.json';
import { hourlyProfile } from './dummyOccupancy';
import { localForecast, withOpening, type ForecastPoint } from './forecast';
import { computeHistory, type History } from './history';
import { hoursFor, isOpenAtHour } from './hours';
import { getOverride, withOverrides } from './overrideStore';
import { getLocalVenues } from './localVenueStore';
import { isLocalVenueId } from './localVenues';
import type { Crowd } from './crowd';
import type { Level } from './occupancy';
import { createStaticApi, type DemoVenue } from './staticApi';

export type Occupancy = {
  level: Level;
  ratio: number;
  updated_at: string;
};

export type AreaOccupancy = {
  level: Level;
  ratio: number;
};

export type Venue = {
  id: number;
  name: string;
  category: string;
  capacity: number;
  lat: number;
  lon: number;
  neighborhood: string;
  district: string;
  tags: string[];
  // v1 fake occupancy: still used by the business panel until it moves to check-ins
  occupancy: Occupancy;
  crowd: Crowd; // v2: occupancy from check-ins
  // v2: "Burayı X keşfetti" (first 30 days); name is null when that check-in was private
  discovery?: { name: string | null; username?: string | null; at: string } | null;
  trend?: number; // v2: different people who checked in during the last 24 hours
  district_occupancy: AreaOccupancy;
  open_now: boolean;
  hours: string; // "08:00–23:00" or "24 saat açık"
  opens_at: string; // next opening time, shown when closed
  pending?: boolean; // v2: added by a user, waiting for approval ("⏳ Onay bekliyor")
  // v2: the business's profile, from the server (cover photo: venueApi.photoUrl)
  photo_at?: string | null;
  instagram?: string | null;
  phone?: string | null;
  verified?: boolean; // "✓ Doğrulanmış işletme"
  // Set by the business on this phone (see overrides.ts)
  description?: string;
  amenity_keys?: string[];
  address?: string;
};

export type HourlyPoint = { hour: number; level: Level; ratio: number; open: boolean };

const API_URL = process.env.EXPO_PUBLIC_API_URL;
// "static": bundled demo data, no server (GitHub Pages build). Otherwise the backend API.
const STATIC_DATA = process.env.EXPO_PUBLIC_DATA_MODE === 'static';

/**
 * Venues served without the backend: the bundled demo venues (static mode
 * only) plus venues that business accounts added on this phone.
 */
const deviceApi = () => createStaticApi([...(STATIC_DATA ? (demoVenues as DemoVenue[]) : []), ...getLocalVenues()]);

const byName = (a: Venue, b: Venue) => a.name.localeCompare(b.name, 'tr');

export async function fetchVenues(
  bbox: string,
  tags: string[],
  signal?: AbortSignal,
): Promise<Venue[]> {
  const local = deviceApi().venuesInBBox(bbox, tags);
  if (STATIC_DATA) return withOverrides(local);
  const params = new URLSearchParams({ bbox });
  if (tags.length > 0) params.set('tags', tags.join(','));
  return withOverrides([...(await getJson<Venue[]>(`/v1/venues?${params}`, signal)), ...local]);
}

export async function searchVenues(
  query: string,
  district: string | null,
  tags: string[],
  signal?: AbortSignal,
): Promise<Venue[]> {
  const local = deviceApi().search(query, district, tags);
  if (STATIC_DATA) return withOverrides(local);
  const params = new URLSearchParams({ q: query });
  if (district) params.set('district', district);
  if (tags.length > 0) params.set('tags', tags.join(','));
  return withOverrides([...(await getJson<Venue[]>(`/v1/venues/search?${params}`, signal)), ...local].sort(byName));
}

export async function fetchVenuesByIds(ids: number[], signal?: AbortSignal): Promise<Venue[]> {
  const local = deviceApi().search('', null, [], ids);
  const remoteIds = ids.filter((id) => !isLocalVenueId(id));
  if (STATIC_DATA || remoteIds.length === 0) return withOverrides(local);
  const params = new URLSearchParams({ ids: remoteIds.join(',') });
  return withOverrides([...(await getJson<Venue[]>(`/v1/venues/search?${params}`, signal)), ...local].sort(byName));
}

export async function fetchDistricts(signal?: AbortSignal): Promise<string[]> {
  const local = deviceApi().districts();
  const remote = STATIC_DATA ? [] : await getJson<string[]>('/v1/districts', signal);
  return [...new Set([...remote, ...local])].sort((a, b) => a.localeCompare(b, 'tr'));
}

/** Today's occupancy per hour for one venue (business stats panel). */
export async function fetchHourly(venueId: number, signal?: AbortSignal): Promise<HourlyPoint[]> {
  if (STATIC_DATA || isLocalVenueId(venueId)) {
    const all = [...(demoVenues as DemoVenue[]), ...getLocalVenues()];
    const venue = all.find((v) => v.id === venueId);
    const opening = getOverride(venueId)?.hours ?? hoursFor(venue?.category ?? '', venue?.always_busy);
    return hourlyProfile(venueId, venue?.popularity ?? 1, new Date(), venue?.always_busy).map((h) => ({
      ...h,
      open: isOpenAtHour(opening, h.hour),
    }));
  }
  return (await getJson<{ hours: HourlyPoint[] }>(`/v1/venues/${venueId}/hourly`, signal)).hours;
}

/** Average occupancy per day for the last `days` days (business weekly / monthly statistics). */
export async function fetchHistory(venueId: number, days: number, signal?: AbortSignal): Promise<History> {
  if (STATIC_DATA || isLocalVenueId(venueId)) {
    const all = [...(demoVenues as DemoVenue[]), ...getLocalVenues()];
    const venue = all.find((v) => v.id === venueId);
    const opening = getOverride(venueId)?.hours ?? hoursFor(venue?.category ?? '', venue?.always_busy);
    return computeHistory(venueId, venue?.popularity ?? 1, venue?.always_busy ?? false, opening, days);
  }
  return getJson<History>(`/v1/venues/${venueId}/history?days=${days}`, signal);
}

/** Expected occupancy in 5-minute steps for the next hours (scheduled notifications). */
export async function fetchForecast(venueId: number, signal?: AbortSignal): Promise<ForecastPoint[]> {
  const all = [...(demoVenues as DemoVenue[]), ...getLocalVenues()];
  const venue = all.find((v) => v.id === venueId);
  const edited = getOverride(venueId)?.hours;
  if (STATIC_DATA || isLocalVenueId(venueId)) {
    const opening = edited ?? hoursFor(venue?.category ?? '', venue?.always_busy);
    return localForecast(venueId, venue?.popularity ?? 1, venue?.always_busy ?? false, opening);
  }
  const { points } = await getJson<{ points: ForecastPoint[] }>(`/v1/venues/${venueId}/forecast`, signal);
  return edited ? withOpening(points, edited) : points;
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (!API_URL) {
    throw new Error('EXPO_PUBLIC_API_URL tanımlı değil (mobile/.env)');
  }
  const response = await fetch(`${API_URL}${path}`, { signal });
  if (!response.ok) {
    throw new Error(`Sunucu hatası: ${response.status}`);
  }
  return response.json();
}
