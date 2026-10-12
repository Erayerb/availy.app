import { useCallback, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { FilterBar } from '../components/FilterBar';
import { BackButton } from '../components/BackButton';
import { CARD_WIDTH, VenueCard } from '../components/VenueCard';
import { VenueMap } from '../components/VenueMap';
import { SELECTED_DOT_SIZE } from '../components/VenueMap.types';
import { useVenues } from '../hooks/useVenues';
import { containsBounds, formatBBox, regionToBounds, type Region } from '../lib/bbox';
import { cardPosition, type Point } from '../lib/cardPosition';
import { toggleTag, type Tag } from '../lib/filters';
import { LEVELS, levelStyle } from '../lib/occupancy';
import { colors } from '../theme';

// Fetch an area twice the visible size so small pans don't trigger a new request
const QUERY_PADDING = 2;
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
  const [queryBounds, setQueryBounds] = useState(() => regionToBounds(initialRegion, QUERY_PADDING));
  const [pinPoint, setPinPoint] = useState<Point | null>(null);
  const [cardHeight, setCardHeight] = useState(0);
  // Bottom edge of the back button + filter card; the venue card must stay below it
  const [headerBottom, setHeaderBottom] = useState(120);
  const { venues, error, lastUpdated } = useVenues(formatBBox(queryBounds), tags);
  const selected = venues.find((v) => v.id === selectedId);

  const handlePointChange = useCallback((point: Point | null) => setPinPoint(point), []);

  const handleRegionChangeComplete = (region: Region) => {
    onRegionSaved(region);
    if (!containsBounds(queryBounds, regionToBounds(region))) {
      setQueryBounds(regionToBounds(region, QUERY_PADDING));
    }
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
      <VenueMap
        initialRegion={initialRegion}
        venues={venues}
        selectedId={selectedId}
        onMarkerPress={onMarkerPress}
        onMapPress={() => onSelect(null)}
        onRegionChangeComplete={handleRegionChangeComplete}
        onSelectedPointChange={handlePointChange}
      />

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
