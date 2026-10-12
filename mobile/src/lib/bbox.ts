export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

/** [minLon, minLat, maxLon, maxLat] */
export type Bounds = [number, number, number, number];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const round = (value: number) => Math.round(value * 1e5) / 1e5;

/** Bounds of a map region, optionally enlarged by `padding` (2 = twice the size). */
export function regionToBounds(region: Region, padding = 1): Bounds {
  const halfLat = (region.latitudeDelta * padding) / 2;
  const halfLon = (region.longitudeDelta * padding) / 2;
  return [
    round(clamp(region.longitude - halfLon, -180, 180)),
    round(clamp(region.latitude - halfLat, -90, 90)),
    round(clamp(region.longitude + halfLon, -180, 180)),
    round(clamp(region.latitude + halfLat, -90, 90)),
  ];
}

/** Backend query format: "minLon,minLat,maxLon,maxLat". */
export function formatBBox(bounds: Bounds): string {
  return bounds.join(',');
}

export function containsBounds(outer: Bounds, inner: Bounds): boolean {
  return (
    inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3]
  );
}
