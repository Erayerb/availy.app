import { memo, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type MapPressEvent } from 'react-native-maps';

import type { Venue } from '../lib/api';
import type { Region } from '../lib/bbox';
import { useSettings } from '../context/SettingsContext';
import { colors } from '../theme';
import { DOT_SIZE, SELECTED_DOT_SIZE, type VenueMapProps } from './VenueMap.types';

// Invisible tap area around each dot: a little larger than the dot, but small
// enough that neighbouring dots' areas don't cover each other
const TOUCH_SIZE = 34;

/**
 * Custom dot instead of the native pin: iOS highlights tapped native pins on
 * its own and that highlight could jump to a neighbouring pin. Here the
 * selected look is driven only by our `selected` state.
 */
const VenueMarker = memo(function VenueMarker({
  venue,
  selected,
  onSelect,
}: {
  venue: Venue;
  selected: boolean;
  onSelect: (id: number) => void;
}) {
  const size = selected ? SELECTED_DOT_SIZE : DOT_SIZE;
  const { crowdLook } = useSettings();
  const { color, glyph } = crowdLook(venue);
  return (
    <Marker
      coordinate={{ latitude: venue.lat, longitude: venue.lon }}
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={() => onSelect(venue.id)}
      zIndex={selected ? 10 : 1}
      tracksViewChanges={false}
    >
      {/* collapsable={false}: a view with only layout styles would otherwise be
          flattened away by React Native, shrinking the marker's touch area */}
      <View style={styles.touchArea} collapsable={false}>
        <View
          style={[
            styles.marker,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
            },
            selected && styles.markerSelected,
          ]}
        >
          {glyph && <Text style={[styles.glyph, { fontSize: size * 0.55 }]}>{glyph}</Text>}
        </View>
      </View>
    </Marker>
  );
});

/** Native map (Apple Maps on iOS, Google Maps on Android). */
export function VenueMap({
  initialRegion,
  venues,
  selectedId,
  onMarkerPress,
  onMapPress,
  onRegionChangeComplete,
  onSelectedPointChange,
  focus,
}: VenueMapProps) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!focus || !mapRef.current) return;
    mapRef.current.animateCamera({ center: { latitude: focus.lat, longitude: focus.lon } }, { duration: 400 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);
  const selected = venues.find((v) => v.id === selectedId);
  const { colorBlind } = useSettings();

  // Track the selected dot's screen position so the card follows it while the map moves
  const updatePoint = useCallback(async () => {
    if (!selected || !mapRef.current) return;
    onSelectedPointChange(
      await mapRef.current.pointForCoordinate({ latitude: selected.lat, longitude: selected.lon }),
    );
  }, [selected, onSelectedPointChange]);

  useEffect(() => {
    onSelectedPointChange(null);
    updatePoint();
  }, [updatePoint, onSelectedPointChange]);

  const handleMapPress = (event: MapPressEvent) => {
    // A marker tap can also reach the map; keep the selection then
    if ((event.nativeEvent as { action?: string }).action === 'marker-press') return;
    onMapPress();
  };

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={initialRegion}
      onRegionChange={updatePoint}
      onRegionChangeComplete={(region: Region) => {
        updatePoint();
        onRegionChangeComplete(region);
      }}
      onPress={handleMapPress}
      showsUserLocation
      showsMyLocationButton={false}
    >
      {venues.map((venue) => {
        const isSelected = venue.id === selectedId;
        return (
          <VenueMarker
            // tracksViewChanges is off, so a new key re-renders the dot when its look changes
            key={`${venue.id}-${venue.crowd?.state}-${venue.crowd?.level}-${venue.open_now}-${isSelected}-${colorBlind}`}
            venue={venue}
            selected={isSelected}
            onSelect={onMarkerPress}
          />
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', height: '100%' },
  touchArea: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    // Nearly invisible fill so iOS treats the whole area as tappable
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  marker: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: colors.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  markerSelected: { borderColor: colors.text, borderWidth: 4 },
  glyph: { color: colors.white, fontWeight: '800', textAlign: 'center' },
});
