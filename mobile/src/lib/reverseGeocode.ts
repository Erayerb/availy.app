/**
 * Turn a picked map point into "district / neighbourhood" for the new-venue
 * form, and a typed address into a point: OpenStreetMap's Nominatim, one request when the user picks a point
 * or taps the button (its policy allows that, not search-as-you-type; that is searchPlaces, via our server).
 */
import {  type LatLon } from './geo.ts';

// line: street and number ("Moda Caddesi 12"), empty when the point has none
export type Address = { district: string; neighborhood: string; line?: string };

type NominatimAddress = Record<string, string | undefined>;

const clean = (name: string | undefined) => (name ?? '').replace(/\s+Mahallesi$/u, '').trim();

export function parseNominatimAddress(address: NominatimAddress | undefined): Address | null {
  if (!address) return null;
  const district = clean(address.town ?? address.city_district ?? address.district ?? address.county);
  if (!district) return null;
  // The mahalle when OSM names it ("neighbourhood": Trump Towers → Mecidiyeköy, not the wider "Osmanbey"),
  // then the well-known semt ("quarter": Moda), then the wider area ("suburb")
  const neighborhood = clean(address.neighbourhood ?? address.quarter ?? address.suburb);
  const line = [address.road ?? address.pedestrian, address.house_number].filter(Boolean).join(' ');
  return line ? { district, neighborhood, line } : { district, neighborhood };
}

export async function reverseGeocode(point: LatLon, signal?: AbortSignal): Promise<Address | null> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(point.lat),
    lon: String(point.lon),
    zoom: '18', // street and house number
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

export type Place = { label: string; detail: string; lat: number; lon: number };

/**
 * Places for the map's search box while typing (street, neighbourhood, district, landmark) in Istanbul, best
 * first: "Moda Caddesi" with "Caferağa, Kadıköy" under it. Through our server (backend/app/places_api.py: Photon,
 * kept for a day, bus stops left out); empty when the service is busy, so the venue results still show.
 */
export async function searchPlaces(query: string, signal?: AbortSignal, near?: LatLon | null): Promise<Place[]> {
  const api = process.env.EXPO_PUBLIC_API_URL;
  if (!api) return [];
  const params = new URLSearchParams({ q: query });
  if (near) {
    params.set('lat', near.lat.toFixed(2));
    params.set('lon', near.lon.toFixed(2));
  }
  try {
    const response = await fetch(`${api}/v1/places?${params}`, { signal });
    return response.ok ? await response.json() : [];
  } catch {
    return [];
  }
}
