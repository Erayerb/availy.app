import { useDeferredValue, useMemo, useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import { useOnPageFocus } from '../context/PageContext';
import { Text, TextInput } from '../components/Text';
import { Pressable } from '../components/Pressable';

import { ClearButton } from '../components/ClearButton';
import { Chip } from '../components/TagChips';
import { FilterBar } from '../components/FilterSheet';
import { VenueGrid } from '../components/VenueGrid';
import { FriendsPlaces } from '../components/FriendsPlaces';
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
import { Icon } from '../components/Icon';
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
  // Signed-in user's session, for "Arkadaşlarının gittiği yerler"
  token: string | null;
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
  token,
  onOpenProfile,
  onOpenNotifications,
}: Props) {
  const visibleDistricts = districtsForSides(useDistricts(), sides);
  const { venues: found, loading, error, refreshing, refresh, update, updatedAt } = useSearch(query, null, tags);
  useOnPageFocus(update);
  // A chip answers at once; the list follows when it can
  const listSort = useDeferredValue(sortMode);
  const listSides = useDeferredValue(sides);
  const listDistricts = useDeferredValue(districts);
  const listHideClosed = useDeferredValue(hideClosed);
  const venues = useMemo(
    () =>
      found.filter(
        (v) => matchesSides(v.district, listSides) && matchesDistricts(v.district, listDistricts) && (!listHideClosed || v.open_now),
      ),
    [found, listSides, listDistricts, listHideClosed],
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
  const [placeOpen, setPlaceOpen] = useState(false);

  // "Önerilen": open places first, nearest first; without a location a mixed order (search results by name)
  const items = useMemo(
    () =>
      sortVenues(venues, listSort, point, (list) => {
        const ordered = point ? sortByDistance(list, point) : searching ? list : stableShuffle(list, SESSION_SEED);
        return [...ordered].sort((a, b) => Number(b.open_now) - Number(a.open_now));
      }),
    [venues, searching, point, listSort],
  );
  const needsLocation = sortMode === 'nearest' && !point;

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Wordmark size={28} />
        <HeaderButtons onOpenProfile={onOpenProfile} onOpenNotifications={onOpenNotifications} />
      </View>

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
            <Icon name="x" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {!searching && <FriendsPlaces token={token} onOpenVenue={onOpenVenue} />}

      {/* Filtrele: Ne arıyorsun?, Sırala (Önerilen / En yakın / En sakin), Kapalıları gizle */}
      <FilterBar
        tags={tags}
        onTagsChange={onTagsChange}
        sortMode={sortMode}
        onSortChange={onSortChange}
        hideClosed={hideClosed}
        onHideClosedChange={onHideClosedChange}
        count={items.length}
        leading={
          // Konum: the current choice opens the sheet; × clears it
          <View style={[styles.place, hasPlaceFilter && styles.placeOn]}>
            <Pressable onPress={() => setPlaceOpen(true)} style={styles.placeMain} accessibilityRole="button" accessibilityLabel="Konum seç">
              <Icon name="map-pin" size={15} color={hasPlaceFilter ? colors.onPrimary : colors.primary} />
              <Text style={[styles.placeText, hasPlaceFilter && styles.placeTextOn]} numberOfLines={1}>
                {placeLabel(sides, districts)}
              </Text>
              {!hasPlaceFilter && <Text style={styles.placeChevron}>▾</Text>}
            </Pressable>
            {hasPlaceFilter && (
              <Pressable
                onPress={() => {
                  onSidesChange([]);
                  onDistrictsChange([]);
                }}
                hitSlop={8}
                style={styles.placeClear}
                accessibilityLabel="Konum filtresini temizle"
              >
                <Icon name="x" size={14} color={colors.onPrimary} />
              </Pressable>
            )}
          </View>
        }
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

  const placeSheet = (
    <Modal visible={placeOpen} transparent animationType="slide" onRequestClose={() => setPlaceOpen(false)}>
      <View style={styles.sheetWrap}>
      <Pressable style={styles.backdrop} onPress={() => setPlaceOpen(false)} accessibilityLabel="Kapat" />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>Konum</Text>
          <ClearButton
            onPress={() => {
              onSidesChange([]);
              onDistrictsChange([]);
            }}
            disabled={!hasPlaceFilter}
          />
        </View>
        <Text style={styles.sheetLabel}>Yaka</Text>
        <View style={styles.wrap}>
          <Chip
            label="Tüm İstanbul"
            active={districts.length === 0 && sides.length === 0}
            onPress={() => {
              onDistrictsChange([]);
              onSidesChange([]);
            }}
          />
          {SIDE_OPTIONS.map(({ side, label }) => (
            <Chip key={side} label={label} active={sides.includes(side)} onPress={() => changeSides(side)} />
          ))}
        </View>
        <Text style={styles.sheetLabel}>İlçe</Text>
        {/* Only the districts that can be picked now (the pilot ones) */}
        <View style={styles.wrap}>
          {visibleDistricts.filter(isPilotDistrict).map((d) => (
            <Chip
              key={d}
              label={d}
              active={districts.includes(d)}
              onPress={() => onDistrictsChange(districts.includes(d) ? districts.filter((x) => x !== d) : [...districts, d])}
            />
          ))}
        </View>
        <Text style={styles.hint}>Diğer ilçeler yakında açılacak.</Text>
        <Pressable onPress={() => setPlaceOpen(false)} style={styles.done}>
          <Text style={styles.doneText}>{items.length} mekanı göster</Text>
        </Pressable>
      </View>
      </View>
    </Modal>
  );

  return (
    <>
    {placeSheet}
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
    </>
  );
}

/** "Tüm İstanbul", "İstanbul (Avr.)", "Kadıköy", "Kadıköy +2" */
function placeLabel(sides: Side[], districts: string[]): string {
  if (districts.length > 0) return districts.length === 1 ? districts[0] : `${districts[0]} +${districts.length - 1}`;
  if (sides.length > 0) return sides.map((s) => SIDE_OPTIONS.find((o) => o.side === s)?.label ?? s).join(', ');
  return 'Tüm İstanbul';
}

const styles = themed(() => StyleSheet.create({
  header: { gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 },
  row: { gap: 8 },
  hint: { fontSize: 13, color: colors.textMuted },
  place: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: colors.cream, maxWidth: 200 },
  placeOn: { backgroundColor: colors.primary },
  placeMain: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingLeft: 11, paddingRight: 11, flexShrink: 1 },
  placeText: { fontSize: 14, fontWeight: '600', color: colors.text, flexShrink: 1 },
  placeTextOn: { color: colors.onPrimary },
  placeChevron: { fontSize: 11, color: colors.textMuted },
  placeClear: { paddingRight: 10, paddingLeft: 2, paddingVertical: 8 },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 34, gap: 10 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 4 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  sheetLabel: { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textMuted, marginTop: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  done: { marginTop: 10, paddingVertical: 13, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center' },
  doneText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
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
