/**
 * Turn a picked map point into "district / neighbourhood" for the new-venue
 * form. Uses OpenStreetMap's free Nominatim service; if that fails, falls back
 * to the nearest known venue's district.
 */
import { distanceKm, type LatLon } from './geo.ts';

export type Address = { district: string; neighborhood: string };

type NominatimAddress = Record<string, string | undefined>;

const clean = (name: string | undefined) => (name ?? '').replace(/\s+Mahallesi$/u, '').trim();

export function parseNominatimAddress(address: NominatimAddress | undefined): Address | null {
  if (!address) return null;
  const district = clean(address.town ?? address.city_district ?? address.district ?? address.county);
  if (!district) return null;
  const neighborhood = clean(address.quarter ?? address.neighbourhood ?? address.suburb);
  return { district, neighborhood };
}

export function nearestVenueAddress(
  point: LatLon,
  venues: (LatLon & { district: string; neighborhood: string })[],
): Address | null {
  const nearest = [...venues].sort((a, b) => distanceKm(point, a) - distanceKm(point, b))[0];
  return nearest ? { district: nearest.district, neighborhood: nearest.neighborhood } : null;
}

export async function reverseGeocode(point: LatLon, signal?: AbortSignal): Promise<Address | null> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(point.lat),
    lon: String(point.lon),
    zoom: '16',
    'accept-language': 'tr',
  });
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, { signal });
    if (!response.ok) return null;
    return parseNominatimAddress((await response.json()).address);
  } catch {
    return null;
  }
}

/** Coordinates for a typed address (Istanbul), via Nominatim search. */
export async function geocodeAddress(address: string, district: string, signal?: AbortSignal): Promise<LatLon | null> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    q: [address, district, 'İstanbul'].filter(Boolean).join(', '),
    limit: '1',
    countrycodes: 'tr',
    'accept-language': 'tr',
  });
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal });
    if (!response.ok) return null;
    const [hit] = await response.json();
    return hit ? { lat: Number(hit.lat), lon: Number(hit.lon) } : null;
  } catch {
    return null;
  }
}

/** Rough centre of a district from the venues already in it (fallback when the address is not found). */
export function districtCenter(district: string, venues: (LatLon & { district: string })[]): LatLon | null {
  const inside = venues.filter((v) => v.district === district);
  if (inside.length === 0) return null;
  return {
    lat: inside.reduce((s, v) => s + v.lat, 0) / inside.length,
    lon: inside.reduce((s, v) => s + v.lon, 0) / inside.length,
  };
}
