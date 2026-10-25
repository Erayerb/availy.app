import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type MapPressEvent } from 'react-native-maps';

import type { Venue } from '../lib/api';
import type { Region } from '../lib/bbox';
import { useSettings } from '../context/SettingsContext';
import { clusterColor, clusterVenues, clusterZoomTarget } from '../lib/clusters';
import { UNEXPLORED_STYLE } from '../lib/occupancy';
import { LABEL_LINE_HEIGHT, LABEL_MAX_WIDTH as LABEL_WIDTH, labelPriority, visibleLabels } from '../lib/labels';
import { colors, getScheme, themed } from '../theme';
import { clusterSize, DOT_SIZE, LABEL_MIN_ZOOM, SELECTED_DOT_SIZE, zoomForDelta, type VenueMapProps } from './VenueMap.types';

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
  label,
  onSelect,
}: {
  venue: Venue;
  selected: boolean;
  label: boolean;
  onSelect: (id: number) => void;
}) {
  const size = selected ? SELECTED_DOT_SIZE : DOT_SIZE;
  const { crowdLook } = useSettings();
  const { color, glyph } = crowdLook(venue);
  return (
    <Marker
      coordinate={{ latitude: venue.lat, longitude: venue.lon }}
      // With a name to its right the marker is wider; keep the dot itself on the venue's spot
      anchor={{ x: label ? TOUCH_SIZE / 2 / (TOUCH_SIZE + LABEL_WIDTH) : 0.5, y: 0.5 }}
      onPress={() => onSelect(venue.id)}
      zIndex={selected ? 10 : 1}
      tracksViewChanges={false}
    >
      {/* collapsable={false}: a view with only layout styles would otherwise be
          flattened away by React Native, shrinking the marker's touch area */}
      <View style={label ? styles.labelled : undefined} collapsable={false}>
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
        {label && (
          <Text style={[styles.label, { color }]} numberOfLines={2}>
            {venue.name}
          </Text>
        )}
      </View>
    </Marker>
  );
});

/** Close dots as one circle with a count; a tap zooms in until they split. */
const ClusterMarker = memo(function ClusterMarker({
  lat,
  lon,
  venues,
  onZoomIn,
}: {
  lat: number;
  lon: number;
  venues: Venue[];
  onZoomIn: (venues: Venue[]) => void;
}) {
  const { crowdLook } = useSettings();
  const size = clusterSize(venues.length);
  const color = clusterColor(venues, (v) => crowdLook(v).color, UNEXPLORED_STYLE.color);
  return (
    <Marker coordinate={{ latitude: lat, longitude: lon }} anchor={{ x: 0.5, y: 0.5 }} onPress={() => onZoomIn(venues)} tracksViewChanges={false}>
      <View style={[styles.cluster, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]} collapsable={false}>
        <Text style={styles.clusterText}>{venues.length}</Text>
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
  userPoint,
}: VenueMapProps) {
  const mapRef = useRef<MapView>(null);
  // Names under the dots once zoomed in to street level. The area is only updated when the
  // zoom changes, since which names overlap does not change while panning
  const [labelRegion, setLabelRegion] = useState<Region>(initialRegion);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const labelled = useMemo(() => {
    if (zoomForDelta(labelRegion.longitudeDelta) < LABEL_MIN_ZOOM || size.width === 0) return new Set<number>();
    // Close enough to the real projection at street level
    const project = (v: Venue) => ({
      x: ((v.lon - labelRegion.longitude) / labelRegion.longitudeDelta) * size.width,
      y: ((labelRegion.latitude - v.lat) / labelRegion.latitudeDelta) * size.height,
    });
    return visibleLabels(labelPriority(venues, selectedId), project);
  }, [venues, selectedId, labelRegion, size]);

  useEffect(() => {
    if (!focus || !mapRef.current) return;
    if (focus.zoom) {
      const delta = 360 / 2 ** focus.zoom;
      mapRef.current.animateToRegion(
        { latitude: focus.lat, longitude: focus.lon, latitudeDelta: delta, longitudeDelta: delta },
        400,
      );
    } else {
      mapRef.current.animateCamera({ center: { latitude: focus.lat, longitude: focus.lon } }, { duration: 400 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);
  const items = useMemo(
    // Zoom in 256 px tiles for this map's width, so the radius is in screen points
    () => clusterVenues(venues, Math.log2(((360 / labelRegion.longitudeDelta) * (size.width || 256)) / 256), selectedId),
    [venues, labelRegion, selectedId, size.width],
  );
  // Zoom towards the cluster: all of it in view, but at most 2 levels closer at a time
  const zoomInto = useCallback(
    (members: Venue[]) => {
      const lats = members.map((v) => v.lat);
      const lons = members.map((v) => v.lon);
      const span = Math.max(Math.max(...lons) - Math.min(...lons), Math.max(...lats) - Math.min(...lats), 1e-6) * 1.6;
      const target = clusterZoomTarget(zoomForDelta(labelRegion.longitudeDelta), zoomForDelta(span));
      const delta = 360 / 2 ** target;
      mapRef.current?.animateToRegion(
        {
          latitude: (Math.max(...lats) + Math.min(...lats)) / 2,
          longitude: (Math.max(...lons) + Math.min(...lons)) / 2,
          latitudeDelta: delta,
          longitudeDelta: delta,
        },
        400,
      );
    },
    [labelRegion],
  );
  const selected = venues.find((v) => v.id === selectedId);
  const { colorBlind } = useSettings();
  const scheme = getScheme();

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
        setLabelRegion((current) =>
          Math.abs(zoomForDelta(current.longitudeDelta) - zoomForDelta(region.longitudeDelta)) < 0.25 ? current : region,
        );
        updatePoint();
        onRegionChangeComplete(region);
      }}
      onPress={handleMapPress}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      showsMyLocationButton={false}
      // Apple Maps' own dark style in the dark theme
      userInterfaceStyle={scheme}
    >
      {userPoint && (
        <Marker
          coordinate={{ latitude: userPoint.lat, longitude: userPoint.lon }}
          anchor={{ x: 0.5, y: 0.5 }}
          zIndex={20}
          tracksViewChanges={false}
          tappable={false}
        >
          <View style={styles.userHalo} collapsable={false}>
            <View style={styles.userDot} />
          </View>
        </Marker>
      )}
      {items.map((item) => {
        if (item.kind === 'cluster') {
          return (
            <ClusterMarker
              key={`${item.key}-${colorBlind}-${scheme}`}
              lat={item.lat}
              lon={item.lon}
              venues={item.venues}
              onZoomIn={zoomInto}
            />
          );
        }
        const venue = item.venue;
        const isSelected = venue.id === selectedId;
        return (
          <VenueMarker
            // tracksViewChanges is off, so a new key re-renders the dot when its look changes
            key={`${venue.id}-${venue.crowd?.state}-${venue.crowd?.level}-${venue.open_now}-${isSelected}-${colorBlind}-${labelled.has(venue.id)}-${scheme}`}
            venue={venue}
            selected={isSelected}
            label={labelled.has(venue.id)}
            onSelect={onMarkerPress}
          />
        );
      })}
    </MapView>
  );
}

const styles = themed(() => StyleSheet.create({
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
  labelled: { width: TOUCH_SIZE + LABEL_WIDTH, flexDirection: 'row', alignItems: 'center' },
  label: {
    width: LABEL_WIDTH,
    // Start just after the dot, not after the wider tap area around it
    marginLeft: -(TOUCH_SIZE - DOT_SIZE) / 2 + 3,
    lineHeight: LABEL_LINE_HEIGHT,
    fontSize: 12,
    fontWeight: '600',
    // Colour comes from the venue's dot; a halo in the page colour so the name reads on any map
    textShadowColor: colors.background,
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 0 },
  },
  glyph: { color: colors.white, fontWeight: '800', textAlign: 'center' },
  cluster: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: colors.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  clusterText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  // "You are here", like Google Maps
  userHalo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(26,115,232,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1A73E8',
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: colors.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
}));
