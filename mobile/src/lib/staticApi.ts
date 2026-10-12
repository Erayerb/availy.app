/**
 * Serverless data source for the GitHub Pages build: the demo venues are
 * bundled into the app and occupancy is computed on the device. Mirrors the
 * backend endpoints so screens don't know the difference.
 */
import type { Venue } from './api';
// .ts extension so Node's test runner can load this file directly
import { averageOccupancy, dummyOccupancy } from './dummyOccupancy.ts';

/** Shape of src/data/demoVenues.json (exported from backend/app/demo_data.py). */
export type DemoVenue = {
  id: number;
  name: string;
  category: string;
  lon: number;
  lat: number;
  capacity: number;
  neighborhood: string;
  district: string;
  tags: string[];
  popularity: number;
};

const lower = (text: string) => text.toLocaleLowerCase('tr-TR');

function withOccupancy(venues: DemoVenue[], all: DemoVenue[], now: Date): Venue[] {
  const districtAverage = new Map<string, ReturnType<typeof averageOccupancy>>();
  for (const district of new Set(venues.map((v) => v.district))) {
    const members = all.filter((v) => v.district === district);
    districtAverage.set(
      district,
      averageOccupancy(members.map((m) => dummyOccupancy(m.id, now, m.popularity).ratio)),
    );
  }
  return venues.map(({ popularity, ...venue }) => ({
    ...venue,
    occupancy: dummyOccupancy(venue.id, now, popularity),
    district_occupancy: districtAverage.get(venue.district)!,
  })) as Venue[];
}

const matchesTags = (venue: DemoVenue, tags: string[]) =>
  tags.length === 0 || venue.tags.some((t) => tags.includes(t));

export function createStaticApi(demoVenues: DemoVenue[]) {
  return {
    venuesInBBox: (bbox: string, tags: string[], now = new Date()) =>
      venuesInBBox(demoVenues, bbox, tags, now),
    search: (query: string, district: string | null, tags: string[], ids?: number[], now = new Date()) =>
      search(demoVenues, query, district, tags, ids, now),
    districts: () => districts(demoVenues),
  };
}

function venuesInBBox(demoVenues: DemoVenue[], bbox: string, tags: string[], now: Date): Venue[] {
  const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
  const inside = demoVenues.filter(
    (v) =>
      v.lon >= minLon && v.lon <= maxLon && v.lat >= minLat && v.lat <= maxLat && matchesTags(v, tags),
  );
  return withOccupancy(inside, demoVenues, now);
}

function search(
  demoVenues: DemoVenue[],
  query: string,
  district: string | null,
  tags: string[],
  ids: number[] | undefined,
  now: Date,
): Venue[] {
  const q = lower(query.trim());
  const found = demoVenues
    .filter(
      (v) =>
        (!q || lower(v.name).includes(q)) &&
        (!district || v.district === district) &&
        matchesTags(v, tags) &&
        (!ids || ids.includes(v.id)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  return withOccupancy(found, demoVenues, now);
}

function districts(demoVenues: DemoVenue[]): string[] {
  return [...new Set(demoVenues.map((v) => v.district))].sort((a, b) => a.localeCompare(b, 'tr'));
}
