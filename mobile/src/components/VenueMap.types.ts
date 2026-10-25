import type { Venue } from '../lib/api';
import type { Region } from '../lib/bbox';
import type { Point } from '../lib/cardPosition';

/** Shared props for the native (react-native-maps) and web (Leaflet) maps. */
export type VenueMapProps = {
  initialRegion: Region;
  venues: Venue[];
  selectedId: number | null;
  onMarkerPress: (id: number) => void;
  onMapPress: () => void;
  onRegionChangeComplete: (region: Region) => void;
  // Screen position of the selected dot, so the venue card can sit above it
  onSelectedPointChange: (point: Point | null) => void;
  // Move the map to this spot (and zoom in to `zoom`, e.g. a searched venue); a new `key` triggers the move again
  focus?: { lat: number; lon: number; key: number; zoom?: number } | null;
  // Google Maps-style blue dot with a light halo (drawn by us on every platform)
  userPoint?: { lat: number; lon: number } | null;
};

export const SELECTED_DOT_SIZE = 30;

// Venue names appear under the dots from this zoom on (street level, about where Apple / Google Maps show place names)
export const LABEL_MIN_ZOOM = 16;
/** Map zoom level for a visible width in degrees of longitude. */
export const zoomForDelta = (longitudeDelta: number) => Math.log2(360 / longitudeDelta);
export const DOT_SIZE = 22;
