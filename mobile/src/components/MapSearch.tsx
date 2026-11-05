import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Text, TextInput } from './Text';
import { Pressable } from './Pressable';

import { useLocation } from '../context/LocationContext';
import { useSettings } from '../context/SettingsContext';
import { searchVenues, type Venue } from '../lib/api';
import { categoryLabel } from '../lib/filters';
import { distanceKm, formatDistance, sortByDistance } from '../lib/geo';
import { shortLocation } from '../lib/location';
import { colors, themed } from '../theme';
import { searchPlaces, type Place } from '../lib/reverseGeocode';
import { CrowdDot } from './CrowdDot';
import { Icon } from './Icon';

const MAX_PLACES = 4;
const PLACE_WAIT_MS = 500;

type Props = { onClose: () => void; onChoose: (venue: Venue) => void; onChoosePlace: (place: Place) => void };

/** The map's 🔍: venues by name / neighbourhood and places ("Teşvikiye Mahallesi"); choosing one moves the map to it. */
export function MapSearch({ onClose, onChoose, onChoosePlace }: Props) {
  const { point } = useLocation();
  const { crowdLook } = useSettings();
  const [query, setQuery] = useState('');
  const [venues, setVenues] = useState<Venue[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);

  // Places from OpenStreetMap: their service asks for few requests, so this waits longer than our own search
  useEffect(() => {
    const text = query.trim();
    if (text.length < 3) return setPlaces([]);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchPlaces(text, controller.signal).then((found) => {
        if (!controller.signal.aborted) setPlaces(found.slice(0, MAX_PLACES));
      });
    }, PLACE_WAIT_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return setVenues([]);
    const controller = new AbortController();
    setLoading(true);
    // Wait while the user is typing
    const timer = setTimeout(() => {
      searchVenues(text, null, [], controller.signal)
        .then((found) => setVenues(point ? sortByDistance(found, point) : found))
        .catch(() => {})
        .finally(() => !controller.signal.aborted && setLoading(false));
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, point]);

  return (
    <View style={styles.overlay}>
      <View style={styles.bar}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Mekan, mahalle ya da semt ara"
          placeholderTextColor={colors.placeholder}
          autoFocus
          autoCorrect={false}
          style={styles.input}
        />
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.cancel}>Vazgeç</Text>
        </Pressable>
      </View>
      <FlatList
        data={venues}
        keyExtractor={(v) => String(v.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            {places.map((place) => (
              <Pressable
                key={`${place.label}-${place.lat}-${place.lon}`}
                onPress={() => onChoosePlace(place)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Icon name="map-pin" size={18} color={colors.primary} />
                <View style={styles.flex}>
                  <Text style={styles.name} numberOfLines={1}>
                    {place.label}
                  </Text>
                  {place.detail ? (
                    <Text style={styles.muted} numberOfLines={1}>
                      {place.detail}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </>
        }
        ListEmptyComponent={
          query.trim().length >= 2 ? (
            places.length > 0 ? undefined : <Text style={styles.muted}>{loading ? 'Aranıyor…' : 'Bu adla bir yer bulunamadı.'}</Text>
          ) : (
            <Text style={styles.muted}>En az 2 harf yaz.</Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => onChoose(item)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <CrowdDot venue={item} size={14} />
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.muted} numberOfLines={1}>
                {categoryLabel(item.category)} · {shortLocation(item.neighborhood, item.district)}
                {point ? ` · ${formatDistance(distanceKm(point, item))}` : ''} · {crowdLook(item).label}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.background, paddingTop: 56 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.cream,
    fontSize: 16,
    color: colors.text,
  },
  cancel: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { opacity: 0.6 },
  flex: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted, paddingVertical: 8 },
}));
