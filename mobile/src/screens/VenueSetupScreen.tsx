import { useCallback, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BackButton } from '../components/BackButton';
import { Chip, TagChips } from '../components/TagChips';
import { VenueMap } from '../components/VenueMap';
import { useDistricts } from '../hooks/useDistricts';
import { useSearch } from '../hooks/useSearch';
import type { Region } from '../lib/bbox';
import { categoryLabel, toggleTag, type Tag } from '../lib/filters';
import { ALL_AMENITIES, type AmenityKey } from '../lib/amenities';
import { addLocalVenue } from '../lib/localVenueStore';
import { saveOverride } from '../lib/overrideStore';
import { validateNewVenue } from '../lib/localVenues';
import { shortLocation } from '../lib/location';
import { districtCenter, geocodeAddress, nearestVenueAddress, reverseGeocode } from '../lib/reverseGeocode';
import { colors } from '../theme';

const CATEGORIES = ['cafe', 'bar', 'restaurant', 'coworking', 'library'];
const ISTANBUL: Region = { latitude: 41.03, longitude: 29.01, latitudeDelta: 0.12, longitudeDelta: 0.12 };
const noop = () => {};

type Props = {
  onDone: (venueId: number) => void;
  onLogout: () => void;
};

/** After business sign up: claim an existing venue or add a new one. */
export function VenueSetupScreen({ onDone, onLogout }: Props) {
  const [mode, setMode] = useState<'pick' | 'new' | 'location'>('pick');
  const [query, setQuery] = useState('');
  const { venues, loading, error } = useSearch(query, null, []);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [amenities, setAmenities] = useState<AmenityKey[]>([]);
  const [district, setDistrict] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  // Center of the picker map; starts at the map's initial center so confirming without moving still works
  const [mapCenter, setMapCenter] = useState<{ lat: number; lon: number }>({
    lat: ISTANBUL.latitude,
    lon: ISTANBUL.longitude,
  });
  const [locating, setLocating] = useState(false);
  const [address, setAddress] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const knownDistricts = useDistricts();
  // A district found from the map may not be in the list yet
  const districts =
    district && !knownDistricts.includes(district) ? [...knownDistricts, district] : knownDistricts;

  const handleRegion = useCallback(
    (region: Region) => setMapCenter({ lat: region.latitude, lon: region.longitude }),
    [],
  );

  const openPicker = () => {
    // Start from what the picker map will show, so "Bu konumu kullan" without moving uses that spot
    setMapCenter(location ?? { lat: ISTANBUL.latitude, lon: ISTANBUL.longitude });
    setMode('location');
  };

  const confirmLocation = async (point: { lat: number; lon: number }) => {
    setLocation(point);
    setMode('new');
    setLocating(true);
    const address = (await reverseGeocode(point)) ?? nearestVenueAddress(point, venues);
    setLocating(false);
    if (address) {
      setDistrict(address.district);
      if (address.neighborhood) setNeighborhood(address.neighborhood);
    }
  };

  const createVenue = async () => {
    const input = { name, category, tags, district, neighborhood, address, location };
    const problem = validateNewVenue(input);
    setFormError(problem);
    if (problem || creating) return;
    setCreating(true);
    // No map pick: find the address; otherwise the district's centre, otherwise central Istanbul
    const point = location ??
      (await geocodeAddress(address, district)) ??
      districtCenter(district, venues) ?? { lat: ISTANBUL.latitude, lon: ISTANBUL.longitude };
    const venue = await addLocalVenue({ ...input, location: point });
    setCreating(false);
    if (amenities.length > 0) await saveOverride(venue.id, { amenities });
    onDone(venue.id);
  };

  if (mode === 'location') {
    return (
      <View style={styles.fill}>
        <VenueMap
          initialRegion={
            location
              ? { latitude: location.lat, longitude: location.lon, latitudeDelta: 0.02, longitudeDelta: 0.02 }
              : ISTANBUL
          }
          venues={[]}
          selectedId={null}
          onMarkerPress={noop}
          onMapPress={noop}
          onRegionChangeComplete={handleRegion}
          onSelectedPointChange={noop}
        />
        {/* Fixed pin in the middle: the user moves the map under it */}
        <View pointerEvents="none" style={styles.crosshair}>
          <Text style={styles.crosshairPin}>📍</Text>
        </View>
        <View style={styles.mapTop}>
          <BackButton onPress={() => setMode('new')} />
          <View style={styles.mapHint}>
            <Text style={styles.mapHintText}>Haritayı kaydırıp pini mekanının üstüne getir</Text>
          </View>
        </View>
        <Pressable style={[styles.primary, styles.mapConfirm]} onPress={() => confirmLocation(mapCenter)}>
          <Text style={styles.primaryText}>Bu konumu kullan</Text>
        </Pressable>
      </View>
    );
  }

  if (mode === 'new') {
    return (
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BackButton onPress={() => setMode('pick')} />
          <Text style={styles.title}>Yeni mekan ekle</Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Mekan adı"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
          />

          <Text style={styles.label}>Tür</Text>
          <View style={styles.wrap}>
            {CATEGORIES.map((c) => (
              <Chip key={c} label={categoryLabel(c)} active={category === c} onPress={() => setCategory(c)} />
            ))}
          </View>

          <Text style={styles.label}>Ne için uygun?</Text>
          <TagChips selected={tags} onToggle={(tag) => setTags((t) => toggleTag(t, tag))} />

          <Text style={styles.label}>Özellikler</Text>
          <View style={styles.wrap}>
            {(Object.keys(ALL_AMENITIES) as AmenityKey[]).map((key) => (
              <Chip
                key={key}
                label={`${ALL_AMENITIES[key].icon} ${ALL_AMENITIES[key].label}`}
                active={amenities.includes(key)}
                onPress={() =>
                  setAmenities((a) => (a.includes(key) ? a.filter((k) => k !== key) : [...a, key]))
                }
              />
            ))}
          </View>

          <Text style={styles.label}>Açık adres</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="Ör. Moda Cad. No:12, Caferağa"
            placeholderTextColor={colors.placeholder}
            multiline
            style={styles.input}
          />
          <Pressable style={styles.secondary} onPress={openPicker}>
            <Text style={styles.secondaryText}>
              {location ? '📍 Haritadaki konumu değiştir' : '📍 Haritadan konum seç (isteğe bağlı)'}
            </Text>
          </Pressable>
          {location && (
            <Text style={styles.locationInfo}>
              {locating
                ? 'Adres bulunuyor…'
                : `Seçilen konum: ${shortLocation(neighborhood, district) || 'adres bulunamadı'} (${location.lat.toFixed(4)}, ${location.lon.toFixed(4)})`}
            </Text>
          )}

          <Text style={styles.label}>Semt (haritadan konum seçilirse otomatik dolar)</Text>
          <View style={styles.wrap}>
            {districts.map((d) => (
              <Chip key={d} label={d} active={district === d} onPress={() => setDistrict(d)} />
            ))}
          </View>
          <TextInput
            value={neighborhood}
            onChangeText={setNeighborhood}
            placeholder="Mahalle (ör. Moda)"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
          />

          {formError && <Text style={styles.error}>{formError}</Text>}

          <Pressable
            style={[styles.primary, creating && styles.busy]}
            onPress={createVenue}
            disabled={creating}
          >
            <Text style={styles.primaryText}>{creating ? 'Adres bulunuyor…' : 'Mekanı oluştur'}</Text>
          </Pressable>
          <Text style={styles.note}>Prototip: yeni mekan sadece bu telefonda görünür.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.fill}>
      <FlatList
        contentContainerStyle={styles.content}
        data={venues}
        keyExtractor={(v) => String(v.id)}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Mekanını seç</Text>
            <Text style={styles.subtitle}>İşletmeni listeden bul ya da yeni ekle.</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="🔍  Mekan ara"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
              autoCorrect={false}
            />
            <Pressable style={styles.secondary} onPress={() => setMode('new')}>
              <Text style={styles.secondaryText}>+ Listede yok mu? Yeni mekan ekle</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>{error ?? (loading ? 'Yükleniyor…' : 'Sonuç yok')}</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => onDone(item.id)}
          >
            <Text style={styles.rowTitle}>{item.name}</Text>
            <Text style={styles.rowSub}>
              {categoryLabel(item.category)} · {shortLocation(item.neighborhood, item.district)}
            </Text>
          </Pressable>
        )}
        ListFooterComponent={
          <Pressable onPress={onLogout} style={styles.logout} hitSlop={10}>
            <Text style={styles.logoutText}>Çıkış yap</Text>
          </Pressable>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40, gap: 12 },
  header: { gap: 12, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: colors.cream,
    fontSize: 16,
    color: colors.text,
  },
  row: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  pressed: { opacity: 0.7 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 13, color: colors.textMuted },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 16 },
  primary: { paddingVertical: 15, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
  secondary: {
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  secondaryText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 14 },
  busy: { opacity: 0.6 },
  locationInfo: { fontSize: 13, color: colors.textMuted },
  note: { textAlign: 'center', color: colors.placeholder, fontSize: 12 },
  logout: { alignItems: 'center', paddingVertical: 16 },
  logoutText: { color: colors.textMuted, textDecorationLine: 'underline' },
  crosshair: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Lift the emoji so its tip (not its center) marks the map center
  crosshairPin: { fontSize: 40, marginBottom: 40 },
  mapTop: {
    position: 'absolute',
    top: 60,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  mapHint: { flex: 1, padding: 12, borderRadius: 14, backgroundColor: colors.surface },
  mapHintText: { fontSize: 14, color: colors.text },
  mapConfirm: { position: 'absolute', left: 20, right: 20, bottom: 40 },
});
