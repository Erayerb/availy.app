import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Pressable';

import { useLocation } from '../context/LocationContext';
import { fetchVenues, type Venue } from '../lib/api';
import type { Region } from '../lib/bbox';
import { bboxAround } from '../lib/nearby';
import { colors, themed } from '../theme';
import { BackButton } from './BackButton';
import { VenueMap } from './VenueMap';

const ISTANBUL: Region = { latitude: 41.03, longitude: 29.01, latitudeDelta: 0.12, longitudeDelta: 0.12 };
const CLOSE: Pick<Region, 'latitudeDelta' | 'longitudeDelta'> = { latitudeDelta: 0.006, longitudeDelta: 0.006 };
const noop = () => {};

type Props = {
  start: { lat: number; lon: number } | null; // the point chosen before, if any
  onBack: () => void;
  onPick: (point: { lat: number; lon: number }) => void;
};

/** Full-screen map with a fixed pin in the middle; venues around and the user's blue dot help find the spot. */
export function LocationPicker({ start, onBack, onPick }: Props) {
  const { point } = useLocation();
  const first = start ?? point;
  const [initial] = useState<Region>(first ? { latitude: first.lat, longitude: first.lon, ...CLOSE } : ISTANBUL);
  const [center, setCenter] = useState({ lat: initial.latitude, lon: initial.longitude });
  const [venues, setVenues] = useState<Venue[]>([]);
  const request = useRef<AbortController | null>(null);

  // Venues around the pin, so the spot is easy to recognise
  useEffect(() => {
    const timer = setTimeout(() => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      fetchVenues(bboxAround(center, 0.008), [], controller.signal).then(setVenues).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [center]);

  const handleRegion = useCallback((region: Region) => setCenter({ lat: region.latitude, lon: region.longitude }), []);

  return (
    <View style={styles.fill}>
      <VenueMap
        initialRegion={initial}
        venues={venues}
        selectedId={null}
        onMarkerPress={noop}
        onMapPress={noop}
        onRegionChangeComplete={handleRegion}
        onSelectedPointChange={noop}
        userPoint={point}
      />
      {/* Fixed pin in the middle: the map moves under it */}
      <View pointerEvents="none" style={styles.crosshair}>
        <Text style={styles.crosshairPin}>📍</Text>
      </View>
      <View style={styles.top}>
        <BackButton onPress={onBack} />
        <View style={styles.hint}>
          <Text style={styles.hintText}>Haritayı kaydırıp pini mekanın üstüne getir</Text>
        </View>
      </View>
      <Pressable style={styles.confirm} onPress={() => onPick(center)}>
        <Text style={styles.confirmText}>Bu konumu kullan</Text>
      </Pressable>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  crosshair: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  // Lift the emoji so its tip (not its centre) marks the map centre
  crosshairPin: { fontSize: 40, marginBottom: 40 },
  top: { position: 'absolute', top: 60, left: 12, right: 12, flexDirection: 'row', gap: 10, alignItems: 'center' },
  hint: { flex: 1, padding: 12, borderRadius: 14, backgroundColor: colors.surface },
  hintText: { fontSize: 14, color: colors.text },
  confirm: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 40,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  confirmText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
}));
