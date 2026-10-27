import { isLocalVenueId } from './localVenues';
import type { Crowd } from './crowd';

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
  crowd: Crowd; // v2: occupancy from check-ins
  // v2: "Burayı X keşfetti" (first 30 days); name is null when that check-in was private
  discovery?: { name: string | null; username?: string | null; at: string } | null;
  trend?: number; // v2: different people who checked in during the last 24 hours
  open_now: boolean;
  hours: string; // "08:00–23:00" or "24 saat açık"
  opens_at: string; // next opening time, shown when closed
  pending?: boolean; // v2: added by a user, waiting for approval ("⏳ Onay bekliyor")
  // v2: the business's profile, from the server (cover photo: venueApi.photoUrl)
  photo_at?: string | null;
  instagram?: string | null;
  phone?: string | null;
  verified?: boolean; // "✓ Doğrulanmış işletme"
  // Written by the venue's business ("Mekan bilgilerini düzenle"); no features: guessed from the type
  description?: string | null;
  amenity_keys?: string[] | null;
  address?: string;
};

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const byName = (a: Venue, b: Venue) => a.name.localeCompare(b.name, 'tr');

export async function fetchVenues(bbox: string, tags: string[], signal?: AbortSignal): Promise<Venue[]> {
  const params = new URLSearchParams({ bbox });
  if (tags.length > 0) params.set('tags', tags.join(','));
  return getJson<Venue[]>(`/v1/venues?${params}`, signal);
}

export async function searchVenues(
  query: string,
  district: string | null,
  tags: string[],
  signal?: AbortSignal,
): Promise<Venue[]> {
  const params = new URLSearchParams({ q: query });
  if (district) params.set('district', district);
  if (tags.length > 0) params.set('tags', tags.join(','));
  return (await getJson<Venue[]>(`/v1/venues/search?${params}`, signal)).sort(byName);
}

export async function fetchVenuesByIds(ids: number[], signal?: AbortSignal): Promise<Venue[]> {
  // Venues added only on a phone in v1 have no server record
  const remoteIds = ids.filter((id) => !isLocalVenueId(id));
  if (remoteIds.length === 0) return [];
  const params = new URLSearchParams({ ids: remoteIds.join(',') });
  return (await getJson<Venue[]>(`/v1/venues/search?${params}`, signal)).sort(byName);
}

export async function fetchDistricts(signal?: AbortSignal): Promise<string[]> {
  return (await getJson<string[]>('/v1/districts', signal)).sort((a, b) => a.localeCompare(b, 'tr'));
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
