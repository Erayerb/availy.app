import { useMemo } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AdBanner } from '../components/AdBanner';
import { ClearButton } from '../components/ClearButton';
import { Chip, TagChips } from '../components/TagChips';
import { VenueGrid } from '../components/VenueGrid';
import { Wordmark } from '../components/Wordmark';
import { useDistricts } from '../hooks/useDistricts';
import { useSearch } from '../hooks/useSearch';
import type { Venue } from '../lib/api';
import { toggleTag, type Tag } from '../lib/filters';
import {
  districtsForSides,
  isPilotDistrict,
  matchesDistricts,
  matchesSides,
  PILOT_NOTE,
  SIDE_OPTIONS,
  toggleSide,
  type Side,
} from '../lib/istanbul';
import { useLocation } from '../context/LocationContext';
import { SORT_OPTIONS, sortVenues, type SortMode } from '../lib/sort';
import { stableShuffle } from '../lib/shuffle';
import { colors } from '../theme';

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
  // Free plan: show the ad slot (null for Premium users)
  onPremium: (() => void) | null;
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
  onPremium,
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
  const hasFilters = districts.length > 0 || tags.length > 0 || sides.length > 0;

  const changeSides = (side: Side) => {
    const next = toggleSide(sides, side);
    onSidesChange(next);
    // Drop districts that belong to a side that is no longer shown
    onDistrictsChange(districts.filter((d) => matchesSides(d, next)));
  };

  const { point } = useLocation();

  // "Önerilen": open places first, then a mixed order (search results by name)
  const items = useMemo(
    () =>
      sortVenues(venues, sortMode, point, (list) => {
        const ordered = searching ? list : stableShuffle(list, SESSION_SEED);
        return [...ordered].sort((a, b) => Number(b.open_now) - Number(a.open_now));
      }),
    [venues, searching, point, sortMode],
  );
  const needsLocation = sortMode === 'nearest' && !point;

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Wordmark size={34} />
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Konum</Text>
        <ClearButton
          onPress={() => {
            onSidesChange([]);
            onDistrictsChange([]);
            onTagsChange([]);
          }}
          disabled={!hasFilters}
        />
      </View>
      <View style={styles.sideRow}>
        {SIDE_OPTIONS.map(({ side, label }) => (
          <Chip key={side} label={label} active={sides.includes(side)} onPress={() => changeSides(side)} />
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Chip
          label="Tüm semtler"
          active={districts.length === 0 && sides.length === 0}
          onPress={() => {
            onDistrictsChange([]);
            onSidesChange([]);
          }}
        />
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
      <Text style={styles.hint}>{PILOT_NOTE}</Text>

      <Text style={styles.sectionTitle}>Ne arıyorsun?</Text>
      <TagChips selected={tags} onToggle={(tag) => onTagsChange(toggleTag(tags, tag))} />

      <View style={styles.search}>
        <Text style={styles.searchIcon}>🔍</Text>
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

      <View style={styles.sortRow}>
        <Text style={styles.sectionTitle}>
          {searching ? 'Arama sonuçları' : sortMode === 'nearest' ? 'Sana en yakın' : sortMode === 'quietest' ? 'Şu an en sakin' : 'Öneriler'}
        </Text>
        <View style={styles.sortChips}>
          {SORT_OPTIONS.map(({ mode, label }) => (
            <Chip key={mode} label={label} active={sortMode === mode} onPress={() => onSortChange(mode)} />
          ))}
          <Chip label="Kapalıları gizle" active={hideClosed} onPress={() => onHideClosedChange(!hideClosed)} />
        </View>
      </View>
      {needsLocation && <Text style={styles.hint}>En yakını göstermek için konum izni gerekli.</Text>}
      {updatedAt && (
        <Text style={styles.hint}>
          Son güncelleme {updatedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          {Platform.OS === 'web' ? '' : ' · yenilemek için aşağı çek'}
        </Text>
      )}
      {onPremium && <AdBanner onPremium={onPremium} />}
    </View>
  );

  return (
    <VenueGrid
      venues={items}
      header={header}
      emptyText={loading ? 'Yükleniyor…' : 'Sonuç bulunamadı'}
      error={error}
      onOpenVenue={onOpenVenue}
      refreshing={refreshing}
      onRefresh={refresh}
    />
  );
}

const styles = StyleSheet.create({
  header: { gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 8 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  row: { gap: 8 },
  sideRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sortRow: { gap: 8 },
  sortChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontSize: 13, color: colors.textMuted },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.cream,
  },
  searchIcon: { fontSize: 15 },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, padding: 0 },
  searchClear: { fontSize: 15, color: colors.textMuted },
});
