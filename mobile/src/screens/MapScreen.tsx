import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import MapView, { Marker, type MapPressEvent } from 'react-native-maps';

import { FilterBar } from '../components/FilterBar';
import { BackButton } from '../components/BackButton';
import { CARD_WIDTH, VenueCard } from '../components/VenueCard';
import { useVenues } from '../hooks/useVenues';
import type { Venue } from '../lib/api';
import { containsBounds, formatBBox, regionToBounds, type Region } from '../lib/bbox';
import { cardPosition, type Point } from '../lib/cardPosition';
import { toggleTag, type Tag } from '../lib/filters';
import { LEVELS, levelStyle } from '../lib/occupancy';
import { colors } from '../theme';

// Fetch an area twice the visible size so small pans don't trigger a new request
const QUERY_PADDING = 2;
const DOT_SIZE = 20;
const SELECTED_DOT_SIZE = 30;
// Invisible tap area around each dot; much easier to hit than the dot itself
const TOUCH_SIZE = 48;

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
              backgroundColor: levelStyle(venue.occupancy.level).color,
            },
            selected && styles.markerSelected,
          ]}
        />
      </View>
    </Marker>
  );
});

type Props = {
  initialRegion: Region;
  onRegionSaved: (region: Region) => void;
  tags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  // Tapping the selected dot again closes its card
  onMarkerPress: (id: number) => void;
  onBack: () => void;
};

export function MapScreen({
  initialRegion,
  onRegionSaved,
  tags,
  onTagsChange,
  selectedId,
  onSelect,
  onMarkerPress,
  onBack,
}: Props) {
  const window = useWindowDimensions();
  const mapRef = useRef<MapView>(null);
  const [queryBounds, setQueryBounds] = useState(() => regionToBounds(initialRegion, QUERY_PADDING));
  const [pinPoint, setPinPoint] = useState<Point | null>(null);
  const [cardHeight, setCardHeight] = useState(0);
  // Bottom edge of the back button + filter card; the venue card must stay below it
  const [headerBottom, setHeaderBottom] = useState(120);
  const { venues, error, lastUpdated } = useVenues(formatBBox(queryBounds), tags);
  const selected = venues.find((v) => v.id === selectedId);

  // Track the selected pin's screen position so the card follows it while the map moves
  const updatePinPoint = useCallback(async () => {
    if (!selected || !mapRef.current) return;
    const point = await mapRef.current.pointForCoordinate({
      latitude: selected.lat,
      longitude: selected.lon,
    });
    setPinPoint(point);
  }, [selected]);

  useEffect(() => {
    setPinPoint(null);
    updatePinPoint();
  }, [updatePinPoint]);

  const handleRegionChangeComplete = (region: Region) => {
    updatePinPoint();
    onRegionSaved(region);
    if (!containsBounds(queryBounds, regionToBounds(region))) {
      setQueryBounds(regionToBounds(region, QUERY_PADDING));
    }
  };

  const handleMapPress = (event: MapPressEvent) => {
    // A marker tap can also reach the map; keep the selection then
    if ((event.nativeEvent as { action?: string }).action === 'marker-press') return;
    onSelect(null);
  };

  const cardTopLeft =
    selected && pinPoint && cardHeight > 0
      ? cardPosition({
          pin: pinPoint,
          card: { width: CARD_WIDTH, height: cardHeight },
          screen: window,
          topInset: headerBottom + 8,
          margin: 8,
          pinHeight: SELECTED_DOT_SIZE / 2 + 4,
        })
      : null;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        onRegionChange={updatePinPoint}
        onRegionChangeComplete={handleRegionChangeComplete}
        onPress={handleMapPress}
      >
        {venues.map((venue) => {
          const isSelected = venue.id === selectedId;
          return (
            <VenueMarker
              // tracksViewChanges is off, so a new key re-renders the dot when its look changes
              key={`${venue.id}-${venue.occupancy.level}-${isSelected}`}
              venue={venue}
              selected={isSelected}
              onSelect={onMarkerPress}
            />
          );
        })}
      </MapView>

      {selected && (
        <View
          style={[
            styles.cardContainer,
            cardTopLeft ? { left: cardTopLeft.x, top: cardTopLeft.y } : styles.cardMeasuring,
          ]}
        >
          <VenueCard
            venue={selected}
            onClose={() => onSelect(null)}
            onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}
          />
        </View>
      )}

      <View style={styles.legend}>
        {LEVELS.map((level) => {
          const { color, label } = levelStyle(level);
          return (
            <View key={level} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={styles.legendText}>{label}</Text>
            </View>
          );
        })}
        <Text style={error ? styles.error : styles.status}>
          {error ??
            (lastUpdated
              ? lastUpdated.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
              : '…')}
        </Text>
      </View>

      <View
        style={styles.header}
        onLayout={(e) => setHeaderBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
      >
        <BackButton onPress={onBack} />
        <FilterBar
          selected={tags}
          onToggle={(tag) => onTagsChange(toggleTag(tags, tag))}
          onClear={() => onTagsChange([])}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: colors.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  markerSelected: { borderColor: colors.text, borderWidth: 4 },
  header: {
    position: 'absolute',
    top: 60,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardContainer: { position: 'absolute' },
  cardMeasuring: { left: 0, top: 0, opacity: 0 },
  legend: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { fontSize: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  status: { fontSize: 11, color: colors.textMuted },
  error: { fontSize: 11, color: colors.danger, maxWidth: 140 },
});
