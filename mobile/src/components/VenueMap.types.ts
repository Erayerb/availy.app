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
};

export const SELECTED_DOT_SIZE = 30;
export const DOT_SIZE = 20;
