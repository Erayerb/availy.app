import type { Level } from './occupancy';
import demoVenues from '../data/demoVenues.json';
import { createStaticApi } from './staticApi';

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
// "static": bundled demo data, no server (GitHub Pages build). Otherwise the backend API.
const STATIC_DATA = process.env.EXPO_PUBLIC_DATA_MODE === 'static';
const staticApi = createStaticApi(demoVenues);

export async function fetchVenues(
  bbox: string,
  tags: string[],
  signal?: AbortSignal,
): Promise<Venue[]> {
  if (STATIC_DATA) return staticApi.venuesInBBox(bbox, tags);
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
  if (STATIC_DATA) return staticApi.search(query, district, tags);
  const params = new URLSearchParams({ q: query });
  if (district) params.set('district', district);
  if (tags.length > 0) params.set('tags', tags.join(','));
  return getJson(`/v1/venues/search?${params}`, signal);
}

export async function fetchVenuesByIds(ids: number[], signal?: AbortSignal): Promise<Venue[]> {
  if (STATIC_DATA) return staticApi.search('', null, [], ids);
  return getJson(`/v1/venues/search?${new URLSearchParams({ ids: ids.join(',') })}`, signal);
}

export async function fetchDistricts(signal?: AbortSignal): Promise<string[]> {
  if (STATIC_DATA) return staticApi.districts();
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
