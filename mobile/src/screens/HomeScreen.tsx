import { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../components/Text';
import { Pressable } from '../components/Pressable';

import { ClearButton } from '../components/ClearButton';
import { Chip } from '../components/TagChips';
import { FilterBar } from '../components/FilterSheet';
import { VenueGrid } from '../components/VenueGrid';
import { Wordmark } from '../components/Wordmark';
import { useDistricts } from '../hooks/useDistricts';
import { useSearch } from '../hooks/useSearch';
import type { Venue } from '../lib/api';
import type { Tag } from '../lib/filters';
import {
  districtsForSides,
  isPilotDistrict,
  matchesDistricts,
  matchesSides,
  SIDE_OPTIONS,
  toggleSide,
  type Side,
} from '../lib/istanbul';
import { useLocation } from '../context/LocationContext';
import { sortByDistance } from '../lib/geo';
import { HeaderButtons } from '../components/HeaderButtons';
import { TabIcon } from '../components/TabIcon';
import { sortVenues, type SortMode } from '../lib/sort';
import { stableShuffle } from '../lib/shuffle';
import { colors, themed } from '../theme';

// New mixed order each app start, stable while the app is open
const SESSION_SEED = String(Date.now());

type Props = {
  tags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  // Location filter (kept by the app so it survives going to the map and back)
  sides: Side[];
  onSidesChange: (sides: Side[]) => void;
  districts: string[];
  onDistrictsChange: (districts: string[]) => void;
  query: string;
  onQueryChange: (query: string) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  hideClosed: boolean;
  onHideClosedChange: (hide: boolean) => void;
  onOpenVenue: (venue: Venue) => void;
  // 🔔 and profile icons at the top right
  onOpenProfile: () => void;
  onOpenNotifications: () => void;
};

export function HomeScreen({
  tags,
  onTagsChange,
  sides,
  onSidesChange,
  districts,
  onDistrictsChange,
  query,
  onQueryChange: setQuery,
  sortMode,
  onSortChange,
  hideClosed,
  onHideClosedChange,
  onOpenVenue,
  onOpenProfile,
  onOpenNotifications,
}: Props) {
  const visibleDistricts = districtsForSides(useDistricts(), sides);
  const { venues: found, loading, error, refreshing, refresh, updatedAt } = useSearch(query, null, tags);
  const venues = useMemo(
    () =>
      found.filter(
        (v) => matchesSides(v.district, sides) && matchesDistricts(v.district, districts) && (!hideClosed || v.open_now),
      ),
    [found, sides, districts, hideClosed],
  );
  const searching = query.trim().length > 0;
  // Konum > Temizle: the place filters only (the rest are reset in Filtrele)
  const hasPlaceFilter = districts.length > 0 || sides.length > 0;

  const changeSides = (side: Side) => {
    const next = toggleSide(sides, side);
    onSidesChange(next);
    // Drop districts that belong to a side that is no longer shown
    onDistrictsChange(districts.filter((d) => matchesSides(d, next)));
  };

  const { point } = useLocation();

  // "Önerilen": open places first, nearest first; without a location a mixed order (search results by name)
  const items = useMemo(
    () =>
      sortVenues(venues, sortMode, point, (list) => {
        const ordered = point ? sortByDistance(list, point) : searching ? list : stableShuffle(list, SESSION_SEED);
        return [...ordered].sort((a, b) => Number(b.open_now) - Number(a.open_now));
      }),
    [venues, searching, point, sortMode],
  );
  const needsLocation = sortMode === 'nearest' && !point;

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Wordmark size={34} />
        <HeaderButtons onOpenProfile={onOpenProfile} onOpenNotifications={onOpenNotifications} />
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Konum</Text>
        <ClearButton
          onPress={() => {
            onSidesChange([]);
            onDistrictsChange([]);
          }}
          disabled={!hasPlaceFilter}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Chip
          label="Tümü"
          active={districts.length === 0 && sides.length === 0}
          onPress={() => {
            onDistrictsChange([]);
            onSidesChange([]);
          }}
        />
        {SIDE_OPTIONS.map(({ side, label }) => (
          <Chip key={side} label={label} active={sides.includes(side)} onPress={() => changeSides(side)} />
        ))}
        {/* Pilot districts first; the rest are visible but cannot be picked yet */}
        {[...visibleDistricts.filter(isPilotDistrict), ...visibleDistricts.filter((d) => !isPilotDistrict(d))].map((d) => (
          <Chip
            key={d}
            label={d}
            active={districts.includes(d)}
            disabled={!isPilotDistrict(d)}
            onPress={() => onDistrictsChange(districts.includes(d) ? districts.filter((x) => x !== d) : [...districts, d])}
          />
        ))}
      </ScrollView>

      <View style={styles.search}>
        <TabIcon name="search" color={colors.textMuted} active={false} size={18} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Mekan ara"
          placeholderTextColor={colors.placeholder}
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <Text style={styles.searchClear}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Filtrele: Ne arıyorsun?, Sırala (Önerilen / En yakın / En sakin), Kapalıları gizle */}
      <FilterBar
        tags={tags}
        onTagsChange={onTagsChange}
        sortMode={sortMode}
        onSortChange={onSortChange}
        hideClosed={hideClosed}
        onHideClosedChange={onHideClosedChange}
        count={items.length}
      />

      {needsLocation && <Text style={styles.hint}>En yakını göstermek için konum izni gerekli.</Text>}
      {updatedAt && (
        <Text style={styles.hint}>
          Son güncelleme {updatedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          {Platform.OS === 'web' ? '' : ' · yenilemek için aşağı çek'}
        </Text>
      )}
    </View>
  );

  return (
    <VenueGrid
      venues={items}
      header={header}
      emptyText="Sonuç bulunamadı"
      loading={loading}
      error={error}
      onOpenVenue={onOpenVenue}
      refreshing={refreshing}
      onRefresh={refresh}
    />
  );
}

const styles = themed(() => StyleSheet.create({
  header: { gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 8 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  row: { gap: 8 },
  hint: { fontSize: 13, color: colors.textMuted },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.cream,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, padding: 0 },
  searchClear: { fontSize: 15, color: colors.textMuted },
}));
