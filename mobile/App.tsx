import { StatusBar } from 'expo-status-bar';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type MapPressEvent } from 'react-native-maps';

import { useVenues } from './src/hooks/useVenues';
import type { Venue } from './src/lib/api';
import { containsBounds, formatBBox, regionToBounds, type Region } from './src/lib/bbox';
import { formatRatio, LEVELS, levelStyle } from './src/lib/occupancy';

const INITIAL_REGION: Region = {
  latitude: 41.03,
  longitude: 29.01,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

// Fetch an area twice the visible size so small pans don't trigger a new request
const QUERY_PADDING = 2;

const VenueMarker = memo(function VenueMarker({
  venue,
  onSelect,
}: {
  venue: Venue;
  onSelect: (id: number) => void;
}) {
  return (
    <Marker
      coordinate={{ latitude: venue.lat, longitude: venue.lon }}
      pinColor={levelStyle(venue.occupancy.level).color}
      onPress={() => onSelect(venue.id)}
    />
  );
});

export default function App() {
  const [queryBounds, setQueryBounds] = useState(() =>
    regionToBounds(INITIAL_REGION, QUERY_PADDING),
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { venues, error, lastUpdated } = useVenues(formatBBox(queryBounds));
  const selected = venues.find((v) => v.id === selectedId);

  const handleRegionChange = (region: Region) => {
    if (!containsBounds(queryBounds, regionToBounds(region))) {
      setQueryBounds(regionToBounds(region, QUERY_PADDING));
    }
  };

  const handleMapPress = (event: MapPressEvent) => {
    // On some platforms a marker tap also reaches the map; keep the selection then
    if ((event.nativeEvent as { action?: string }).action === 'marker-press') return;
    setSelectedId(null);
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={INITIAL_REGION}
        onRegionChangeComplete={handleRegionChange}
        onPress={handleMapPress}
      >
        {venues.map((venue) => (
          <VenueMarker key={venue.id} venue={venue} onSelect={setSelectedId} />
        ))}
      </MapView>

      <View style={styles.panel}>
        <View style={styles.legend}>
          {LEVELS.map((level) => {
            const { color, label } = levelStyle(level);
            return (
              <View key={level} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text>{label}</Text>
              </View>
            );
          })}
        </View>
        <Text style={error ? styles.error : styles.status}>
          {error ?? (lastUpdated ? `Güncellendi: ${lastUpdated.toLocaleTimeString('tr-TR')}` : 'Yükleniyor…')}
        </Text>
      </View>

      {selected && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{selected.name}</Text>
            <Pressable onPress={() => setSelectedId(null)} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.cardRow}>
            <View
              style={[styles.dot, { backgroundColor: levelStyle(selected.occupancy.level).color }]}
            />
            <Text style={styles.cardLevel}>{levelStyle(selected.occupancy.level).label}</Text>
            <Text style={styles.cardRatio}>{formatRatio(selected.occupancy.ratio)}</Text>
          </View>
        </View>
      )}

      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  panel: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    gap: 6,
  },
  legend: { flexDirection: 'row', justifyContent: 'space-around' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  status: { textAlign: 'center', color: '#555', fontSize: 12 },
  error: { textAlign: 'center', color: '#d64545', fontSize: 12 },
  card: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '600', flexShrink: 1 },
  close: { fontSize: 18, color: '#888' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardLevel: { fontSize: 15 },
  cardRatio: { fontSize: 15, color: '#555', marginLeft: 'auto' },
});
