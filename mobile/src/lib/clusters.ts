/**
 * Map clustering: dots closer than a finger's width on screen become one circle with a count
 * ("12"). Zooming in splits them; from street level on every venue has its own dot.
 */
export const CLUSTER_RADIUS_PX = 36;
export const CLUSTER_MAX_ZOOM = 16; // from this zoom on no clusters

type Point = { id: number; lat: number; lon: number };

export type MapItem<T extends Point> =
  | { kind: 'venue'; venue: T }
  | { kind: 'cluster'; key: string; lat: number; lon: number; venues: T[] };

/**
 * How far a tap on a cluster zooms in: enough for all of it to fit, but at most 2 levels at a time
 * (a small cluster would otherwise jump right down to street level).
 */
export function clusterZoomTarget(currentZoom: number, fitZoom: number): number {
  return Math.min(fitZoom, currentZoom + 2, CLUSTER_MAX_ZOOM + 1);
}

/** Web Mercator pixel position at a zoom level (256 px tiles), as Leaflet and the native maps use. */
export function project(lat: number, lon: number, zoom: number) {
  const scale = 256 * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/**
 * Greedy clustering: each venue not yet taken gathers the free ones within the radius around it.
 * The selected venue always keeps its own dot. Same input, same clusters (stable ids).
 */
export function clusterVenues<T extends Point>(
  venues: T[],
  zoom: number,
  selectedId: number | null = null,
  radius = CLUSTER_RADIUS_PX,
): MapItem<T>[] {
  if (zoom >= CLUSTER_MAX_ZOOM) return venues.map((venue) => ({ kind: 'venue', venue }));
  const points = [...venues].sort((a, b) => a.id - b.id).map((v) => ({ venue: v, ...project(v.lat, v.lon, zoom) }));
  const taken = new Set<number>();
  const items: MapItem<T>[] = [];
  for (const p of points) {
    if (taken.has(p.venue.id)) continue;
    taken.add(p.venue.id);
    if (p.venue.id === selectedId) {
      items.push({ kind: 'venue', venue: p.venue });
      continue;
    }
    const near = points.filter(
      (q) => !taken.has(q.venue.id) && q.venue.id !== selectedId && Math.hypot(q.x - p.x, q.y - p.y) <= radius,
    );
    if (near.length === 0) {
      items.push({ kind: 'venue', venue: p.venue });
      continue;
    }
    near.forEach((q) => taken.add(q.venue.id));
    const members = [p.venue, ...near.map((q) => q.venue)];
    items.push({
      kind: 'cluster',
      key: `c${p.venue.id}-${members.length}`,
      lat: members.reduce((sum, v) => sum + v.lat, 0) / members.length,
      lon: members.reduce((sum, v) => sum + v.lon, 0) / members.length,
      venues: members,
    });
  }
  return items;
}

/**
 * A cluster's colour: what most of its open, freshly reported or unexplored dots show (ties: the
 * first one's), so a quiet area reads green from afar. Closed and stale (grey) dots do not vote;
 * a cluster of only those takes `fallback`, so clusters are never grey.
 */
export function clusterColor<T extends { open_now: boolean; crowd?: { state: string } }>(
  venues: T[],
  colorOf: (venue: T) => string,
  fallback: string,
): string {
  const voters = venues.filter((v) => v.open_now && v.crowd?.state !== 'stale');
  return voters.length > 0 ? majorityColor(voters, colorOf) : fallback;
}

/** The colour most of the dots have (ties: the first one's). */
export function majorityColor<T>(venues: T[], colorOf: (venue: T) => string): string {
  const counts = new Map<string, number>();
  for (const v of venues) counts.set(colorOf(v), (counts.get(colorOf(v)) ?? 0) + 1);
  let best = colorOf(venues[0]);
  for (const [color, n] of counts) if (n > (counts.get(best) ?? 0)) best = color;
  return best;
}
