import type { Level } from './occupancy';

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
  occupancy: Occupancy;
  district_occupancy: AreaOccupancy;
};

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export async function fetchVenues(
  bbox: string,
  tags: string[],
  signal?: AbortSignal,
): Promise<Venue[]> {
  const params = new URLSearchParams({ bbox });
  if (tags.length > 0) params.set('tags', tags.join(','));
  return getJson(`/v1/venues?${params}`, signal);
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
  return getJson(`/v1/venues/search?${params}`, signal);
}

export async function fetchDistricts(signal?: AbortSignal): Promise<string[]> {
  return getJson('/v1/districts', signal);
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
