/**
 * Venues added by business accounts on this phone (prototype). They get ids
 * from LOCAL_ID_START up so they never collide with server/demo ids.
 */
import type { DemoVenue } from './staticApi.ts';

export const LOCAL_ID_START = 100_001;
export const DEFAULT_CAPACITY = 50;

export const isLocalVenueId = (id: number) => id >= LOCAL_ID_START;

export type NewVenueInput = {
  name: string;
  category: string;
  tags: string[];
  district: string;
  neighborhood: string;
  address: string; // open address; used to find the location when none is picked on the map
  location: { lat: number; lon: number } | null;
};

export function validateNewVenue(input: NewVenueInput): string | null {
  if (input.name.trim().length < 2) return 'Mekan adını yaz.';
  if (!input.category) return 'Mekan türünü seç.';
  if (input.tags.length === 0) return 'En az bir amaç seç (ör. Sosyalleşme).';
  if (!input.district) return 'Semti seç.';
  if (!input.location && input.address.trim().length < 5) return 'Açık adresi yaz ya da haritadan konum seç.';
  return null;
}

/** `location` must be resolved (map pick or address lookup) before creating. */
export function createLocalVenue(
  input: NewVenueInput & { location: { lat: number; lon: number } },
  existing: DemoVenue[],
): DemoVenue {
  const id = Math.max(LOCAL_ID_START - 1, ...existing.map((v) => v.id)) + 1;
  return {
    id,
    name: input.name.trim(),
    category: input.category,
    lat: input.location.lat,
    lon: input.location.lon,
    address: input.address.trim(),
    // Not asked in the form any more; kept for the data model
    capacity: DEFAULT_CAPACITY,
    neighborhood: input.neighborhood.trim(),
    district: input.district,
    tags: [...input.tags],
    popularity: 1,
  };
}

export function parseLocalVenues(raw: unknown): DemoVenue[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v) => v && isLocalVenueId(v.id) && typeof v.name === 'string');
}
