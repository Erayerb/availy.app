import { createLocalVenue, parseLocalVenues, type NewVenueInput } from './localVenues';
import type { DemoVenue } from './staticApi';
import { KEYS, loadJson, saveJson } from './storage';

// Loaded once at startup so the (synchronous) data layer can merge them into results
let cache: DemoVenue[] = [];

export async function loadLocalVenues(): Promise<void> {
  cache = parseLocalVenues(await loadJson<unknown>(KEYS.localVenues));
}

export const getLocalVenues = () => cache;

export async function addLocalVenue(
  input: NewVenueInput & { location: { lat: number; lon: number } },
): Promise<DemoVenue> {
  const venue = createLocalVenue(input, cache);
  cache = [...cache, venue];
  await saveJson(KEYS.localVenues, cache);
  return venue;
}
