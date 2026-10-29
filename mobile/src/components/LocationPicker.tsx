import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from './Text';
import { Pressable } from './Pressable';

import { useLocation } from '../context/LocationContext';
import { fetchVenues, type Venue } from '../lib/api';
import type { Region } from '../lib/bbox';
import { bboxAround } from '../lib/nearby';
import { searchPlaces, type Place } from '../lib/reverseGeocode';
import { colors, themed } from '../theme';
import { BackButton } from './BackButton';
import { VenueMap } from './VenueMap';
import { InlineIcon } from './Icon';
import { TabIcon } from './TabIcon';

const ISTANBUL: Region = { latitude: 41.03, longitude: 29.01, latitudeDelta: 0.12, longitudeDelta: 0.12 };
const CLOSE: Pick<Region, 'latitudeDelta' | 'longitudeDelta'> = { latitudeDelta: 0.006, longitudeDelta: 0.006 };
const noop = () => {};

type Props = {
  start: { lat: number; lon: number } | null; // the point chosen before, if any
  onBack: () => void;
  onPick: (point: { lat: number; lon: number }) => void;
};

/**
 * Full-screen map with a fixed pin in the middle; venues around and the user's blue dot help find the spot.
 * The search box at the top lists streets, neighbourhoods and places right under it as you type (like
 * Google Maps); picking one takes the map there.
 */
export function LocationPicker({ start, onBack, onPick }: Props) {
  const { point } = useLocation();
  const first = start ?? point;
  const [initial] = useState<Region>(first ? { latitude: first.lat, longitude: first.lon, ...CLOSE } : ISTANBUL);
  const [center, setCenter] = useState({ lat: initial.latitude, lon: initial.longitude });
  const [venues, setVenues] = useState<Venue[]>([]);
  const request = useRef<AbortController | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Place[] | null>(null); // null: no search going on
  const [focus, setFocus] = useState<{ lat: number; lon: number; key: number; zoom: number } | null>(null);

  // Results as the user types (a short pause first: the address service allows about one request a second)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return setResults(null);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      const found = await searchPlaces(q, controller.signal);
      if (controller.signal.aborted) return;
      setSearching(false);
      setResults(found);
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const goTo = (place: Place) => {
    // Street level, so the pin can be put on the very door
    setFocus({ lat: place.lat, lon: place.lon, zoom: 17, key: Date.now() });
    setCenter({ lat: place.lat, lon: place.lon });
    setResults(null);
    setQuery(place.label);
    Keyboard.dismiss();
  };

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
        focus={focus}
      />
      {/* Fixed pin in the middle: the map moves under it */}
      <View pointerEvents="none" style={styles.crosshair}>
        <Text style={styles.crosshairPin}><InlineIcon name="map-pin" /></Text>
      </View>
      <View style={styles.top}>
        <BackButton onPress={onBack} />
        <View style={styles.search}>
          <TabIcon name="search" color={colors.textMuted} active={false} size={18} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => results?.[0] && goTo(results[0])}
            placeholder="Sokak, mahalle ya da semt ara"
            placeholderTextColor={colors.placeholder}
            returnKeyType="search"
            autoCorrect={false}
            style={styles.searchInput}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Aramayı temizle">
              <Text style={styles.searchGo}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>
      {results === null && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>Haritayı kaydırıp pini mekanın tam üstüne getir</Text>
        </View>
      )}
      {results !== null && (
        // Google Maps-style list right under the search box; the map stays visible below it
        <View style={styles.sheet}>
          {searching && results.length === 0 && <Text style={[styles.sheetMuted, styles.sheetNote]}>Aranıyor…</Text>}
          {!searching && results.length === 0 && (
            <Text style={[styles.sheetMuted, styles.sheetNote]}>Bulunamadı; sokak adını ve semti birlikte yaz.</Text>
          )}
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.sheetList}>
            {results.map((place) => (
              <Pressable key={`${place.lat},${place.lon}`} style={styles.result} onPress={() => goTo(place)}>
                <Text style={styles.resultIcon}>
                  <InlineIcon name="map-pin" />
                </Text>
                <View style={styles.flex}>
                  <Text style={styles.resultTitle} numberOfLines={1}>
                    {place.label}
                  </Text>
                  {place.detail ? (
                    <Text style={styles.sheetMuted} numberOfLines={1}>
                      {place.detail}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
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
  crosshairPin: { fontSize: 40, marginBottom: 40, color: colors.primary },
  top: { position: 'absolute', top: 60, left: 12, right: 12, flexDirection: 'row', gap: 10, alignItems: 'center' },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: colors.surface },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },
  searchGo: { fontSize: 15, fontWeight: '700', color: colors.primary },
  hint: { position: 'absolute', top: 116, left: 12, right: 12, padding: 10, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center' },
  hintText: { fontSize: 14, color: colors.text },
  sheet: {
    position: 'absolute',
    top: 112,
    left: 66,
    right: 12,
    maxHeight: 250,
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  sheetList: { flexGrow: 0 },
  sheetMuted: { fontSize: 13, color: colors.textMuted },
  sheetNote: { paddingVertical: 10 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  resultIcon: { fontSize: 18, color: colors.primary },
  resultTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  flex: { flex: 1 },
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
