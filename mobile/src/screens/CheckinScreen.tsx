import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../components/Text';
import { Pressable } from '../components/Pressable';

import { BackButton } from '../components/BackButton';
import { CrowdDot } from '../components/CrowdDot';
import { useLocation } from '../context/LocationContext';
import { useSettings } from '../context/SettingsContext';
import { fetchVenues, searchVenues, type Venue } from '../lib/api';
import { categoryLabel } from '../lib/filters';
import { distanceKm, formatDistance, sortByDistance } from '../lib/geo';
import { shortLocation } from '../lib/location';
import { bboxAround, CHECKIN_RADIUS_KM } from '../lib/nearby';
import { colors, themed } from '../theme';
import { InlineIcon } from '../components/Icon';

// Nearest venues: about 1.5 km around the user, at most this many
const NEARBY_DELTA = 0.015;
const MAX_NEARBY = 30;

type Props = { onBack: () => void; onOpenVenue: (venue: Venue) => void; onAddVenue: () => void };

/** v2 map "+": nearest venues and a search; tapping one opens its page, where the check-in is. */
export function CheckinScreen({ onBack, onOpenVenue, onAddVenue }: Props) {
  const { point, locate } = useLocation();
  const { crowdLook } = useSettings();
  const [query, setQuery] = useState('');
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  useEffect(() => {
    const text = query.trim();
    if (!text && !point) {
      setVenues([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    // Wait while the user is typing
    const timer = setTimeout(
      () => {
        const request = text
          ? searchVenues(text, null, [], controller.signal)
          : fetchVenues(bboxAround(point!, NEARBY_DELTA), [], controller.signal);
        request
          .then((found) => {
            const sorted = point ? sortByDistance(found, point) : found;
            setVenues(text ? sorted : sorted.slice(0, MAX_NEARBY));
            setError(null);
          })
          .catch((e) => {
            if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Mekanlar yüklenemedi.');
          })
          .finally(() => !controller.signal.aborted && setLoading(false));
      },
      text ? 300 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, point]);

  const askLocation = async () => {
    const result = await locate();
    if (result.error === 'blocked') setLocationNote("Konum izni kapalı. Ayarlar > availy > Konum'dan açabilirsin.");
    else if (result.error) setLocationNote('Konumun alınamadı.');
    else setLocationNote(null);
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={[styles.title, styles.flex]}>Check-in yap</Text>
        {/* The venue is not in the list */}
        <Pressable onPress={onAddVenue} style={styles.add} hitSlop={6} accessibilityLabel="Mekan ekle">
          <Text style={styles.addText}><InlineIcon name="plus" /> Mekan ekle</Text>
        </Pressable>
      </View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Mekan ara"
        placeholderTextColor={colors.placeholder}
        style={styles.input}
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      {!point && !query.trim() && (
        <View style={styles.notice}>
          <Text style={styles.muted}>En yakın mekanları görmek için konum izni ver ya da mekan ara.</Text>
          <Pressable style={styles.secondary} onPress={askLocation}>
            <Text style={styles.secondaryText}>Konumumu kullan</Text>
          </Pressable>
          {locationNote && <Text style={styles.error}>{locationNote}</Text>}
        </View>
      )}
      {(point || query.trim()) && (
        <Text style={styles.sectionTitle}>{query.trim() ? 'Arama sonuçları' : 'En yakın mekanlar'}</Text>
      )}
    </View>
  );

  const empty = error ?? (loading ? 'Yükleniyor…' : query.trim() ? 'Bu adla mekan bulunamadı.' : point ? 'Yakında mekan yok.' : '');

  return (
    <FlatList
      style={styles.page}
      contentContainerStyle={styles.content}
      data={venues}
      keyExtractor={(v) => String(v.id)}
      ListHeaderComponent={header}
      ListEmptyComponent={empty ? <Text style={error ? styles.error : styles.muted}>{empty}</Text> : undefined}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => {
        const km = point ? distanceKm(point, item) : null;
        const reachable = km !== null && km <= CHECKIN_RADIUS_KM && item.open_now;
        return (
          <Pressable
            onPress={() => onOpenVenue(item)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <CrowdDot venue={item} size={14} />
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.muted} numberOfLines={1}>
                {categoryLabel(item.category)} · {shortLocation(item.neighborhood, item.district)}
                {km !== null ? ` · ${formatDistance(km)}` : ''}
              </Text>
              <Text style={reachable ? styles.reachable : styles.muted}>
                {!item.open_now ? 'Kapalı' : reachable ? <><InlineIcon name="map-pin" /> Check-in yapabilirsin</> : crowdLook(item).label}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = themed(() => StyleSheet.create({
  add: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5, borderColor: colors.primary },
  addText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 40, gap: 8 },
  header: { gap: 12, marginBottom: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  input: { padding: 12, borderRadius: 12, backgroundColor: colors.cream, fontSize: 15, color: colors.text },
  notice: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  flex: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  reachable: { fontSize: 13, color: colors.success, fontWeight: '600' },
  chevron: { fontSize: 22, color: colors.textMuted },
  secondary: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  secondaryText: { color: colors.primary, fontWeight: '700' },
  error: { color: colors.danger },
}));
