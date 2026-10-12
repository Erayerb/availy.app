import type { Venue } from './api';
import { applyOverride, type VenueOverride } from './overrides';
import { KEYS, loadJson, saveJson } from './storage';

// Loaded once at startup so the data layer can apply edits synchronously
let cache: Record<string, VenueOverride> = {};

export async function loadOverrides(): Promise<void> {
  const raw = await loadJson<Record<string, VenueOverride>>(KEYS.venueOverrides);
  cache = raw && typeof raw === 'object' ? raw : {};
}

export const getOverride = (venueId: number): VenueOverride | undefined => cache[venueId];

export async function saveOverride(venueId: number, override: VenueOverride): Promise<void> {
  cache = { ...cache, [venueId]: override };
  await saveJson(KEYS.venueOverrides, cache);
}

export const withOverrides = (venues: Venue[]): Venue[] => venues.map((v) => applyOverride(v, cache[v.id]));
