import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Tip } from '../components/Tip';
import { WhileAway } from '../components/WhileAway';
import { LayoutAnimation, Modal,  StyleSheet, View } from 'react-native';
import { useOnPageFocus } from '../context/PageContext';
import { Text, TextInput } from '../components/Text';
import { Pressable } from '../components/Pressable';

import { ClearButton } from '../components/ClearButton';
import { Chip } from '../components/TagChips';
import { FilterBar } from '../components/FilterSheet';
import { VenueGrid } from '../components/VenueGrid';
import { FriendsPlaces } from '../components/FriendsPlaces';
import { HomeRows } from '../components/HomeRows';
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
import { sponsoredFirst } from '../lib/sponsors';
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
  // "Arkadaşlarının gittiği yerler" with nothing yet: open Sosyal > Arkadaşlar, or invite with my name
  onOpenFriends?: () => void;
  inviteName?: string | null;
  // 🔔 and profile icons at the top right
  onOpenProfile: () => void;
  onOpenNotifications: () => void;
  onRegister?: () => void; // a guest: "Arkadaşların nerede?" asks them to sign up
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
  onOpenFriends,
  inviteName,
  onOpenProfile,
  onOpenNotifications,
  onRegister,
}: Props) {
  const visibleDistricts = districtsForSides(useDistricts(), sides);
  const { venues: found, loading, error, refreshing, refresh, update } = useSearch(query, null, tags);
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
  // The search box: closed into an icon at the top right until tapped (or while a search is typed)
  const [searchOpen, setSearchOpen] = useState(false);
  const searchVisible = searchOpen || query.length > 0;
  const toggleSearch = (open: boolean) => {
    // The box grows in, and the page moves down with it
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (!open) setQuery('');
    setSearchOpen(open);
  };

  // "Önerilen": open places first, nearest first; without a location a mixed order (search results by name)
  const [shown, setShown] = useState(PAGE);
  // A new filter, place or order starts the list short again
  useEffect(() => setShown(PAGE), [tags, sides, districts, listSort, hideClosed]);
  const items = useMemo(
    () => {
      const sorted = sortVenues(venues, listSort, point, (list) => {
        const ordered = point ? sortByDistance(list, point) : searching ? list : stableShuffle(list, SESSION_SEED);
        return [...ordered].sort((a, b) => Number(b.open_now) - Number(a.open_now));
      });
      // Sponsored open places first in the default order (a chosen sort or a search is left as it is)
      return listSort === 'recommended' && !searching ? sponsoredFirst(sorted) : sorted;
    },
    [venues, searching, point, listSort],
  );

  // "Arkadaşların nerede?" is the first title (a guest sees it with a sign-up card under it); without it the
  // first row's title ("Ne arıyorsun?") takes Konum and search, so no empty line is left above it
  const guestCard = !token && Boolean(onRegister);
  const ownTitle = (Boolean(token) || guestCard) && !searching;
  const pageControls = (
    <>
      {/* Konum: next to search, for the whole page (every row and the list below); × clears it */}
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
      <Tip id="homeSearch" after="campaignsButton" placement="below" radius={20} text="Mekan ara: adını yaz, sonuçlar burada listelenir.">
        <Pressable onPress={() => toggleSearch(true)} style={styles.searchButton} hitSlop={8} accessibilityLabel="Mekan ara">
          <TabIcon name="search" color={colors.onPrimary} active={false} size={18} />
        </Pressable>
      </Tip>
    </>
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Wordmark size={28} />
        <HeaderButtons onOpenProfile={onOpenProfile} onOpenNotifications={onOpenNotifications} />
      </View>

      {/* Under the icons, at the right: search as an icon on the first section's title line (no row of its own);
          a tap opens the box in its place */}
      {!searchVisible && ownTitle && (
        <View style={styles.titleRow}>
          <Text style={styles.sectionTitle} numberOfLines={1}>Arkadaşların nerede?</Text>
          {pageControls}
        </View>
      )}

      {searchVisible && (
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
            autoFocus={searchOpen}
          />
          <Pressable onPress={() => toggleSearch(false)} hitSlop={10} accessibilityLabel="Aramayı kapat">
            <Icon name="x" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      )}

      {!searching && guestCard && (
        <View style={styles.guest}>
          <View style={styles.guestIcon}>
            <Icon name="users" size={20} color={colors.primary} />
          </View>
          <View style={styles.guestBody}>
            <Text style={styles.guestText}>Arkadaşlarının şu an nerede olduğunu görmek için kayıt ol. Check-in'lerin ve puanların seninle gelir.</Text>
            <Pressable onPress={onRegister} style={styles.guestButton} accessibilityRole="button">
              <Text style={styles.guestButtonText}>Kayıt ol</Text>
            </Pressable>
          </View>
        </View>
      )}

      {!searching && (
        <FriendsPlaces token={token} onOpenVenue={onOpenVenue} onAddFriends={onOpenFriends} inviteName={inviteName} hideTitle />
      )}

      {!searching && <WhileAway token={token} onOpenVenue={onOpenVenue} onOpenNotifications={onOpenNotifications} />}

      {/* Sideways rows: Şu an sakin, yakınında · Ne arıyorsun? · Trend olanlar · Keşfedilmeyi bekleyenler */}
      {!searching && (
        <HomeRows venues={venues} onOpenVenue={onOpenVenue} placeChosen={hasPlaceFilter} aside={!ownTitle && !searchVisible ? pageControls : null} />
      )}

      {/* Tüm mekanlar: the title and "Filtrele" (Ne arıyorsun?, Kapalıları gizle) */}
      <FilterBar
        tags={tags}
        onTagsChange={onTagsChange}
        sortMode={sortMode}
        onSortChange={onSortChange}
        hideClosed={hideClosed}
        onHideClosedChange={onHideClosedChange}
        count={items.length}
        title={searching ? 'Sonuçlar' : 'Tüm mekanlar'}
      />
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
        {/* Not in the pilot yet: still usable (the same tone as the website) */}
        <View style={styles.soon}>
          <Text style={styles.soonTitle}>Senin ilçen listede yok mu?</Text>
          <Text style={styles.soonText}>
            <Text style={styles.soonBold}>Yine de kullanabilirsin.</Text> Bulunduğun mekanı ekle, ilk check-in'i yap,{' '}
            <Text style={styles.soonBold}>keşfeden sen ol</Text>. Diğer ilçeler çok yakında.
          </Text>
        </View>
        <Pressable onPress={() => setPlaceOpen(false)} style={styles.done}>
          <Text style={styles.doneText}>{items.length} mekanı göster</Text>
        </Pressable>
      </View>
      </View>
    </Modal>
  );

  // "Tüm mekanlar": a short list (sponsored first, then mixed); more on request. A search shows every result
  const shownItems = searching ? items : items.slice(0, shown);
  const more = items.length - shownItems.length;

  return (
    <>
    {placeSheet}
    <VenueGrid
      venues={shownItems}
      footer={
        more > 0 ? (
          <Pressable onPress={() => setShown((n) => n + PAGE)} style={styles.more} accessibilityRole="button">
            <Text style={styles.moreText}>Daha fazla göster</Text>
          </Pressable>
        ) : null
      }
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
  return 'İstanbul';
}

const PAGE = 20;

const styles = themed(() => StyleSheet.create({
  more: { alignSelf: 'center', marginTop: 4, marginBottom: 12, paddingVertical: 11, paddingHorizontal: 22, borderRadius: 14, backgroundColor: colors.cream },
  moreText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  // As tall as the title text: Konum and search stick out above and below, so the title → content gap is the
  // same 12 as every other section's (the row with its buttons was 20 px taller)
  titleRow: { height: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, zIndex: 15, elevation: 15 },
  sectionTitle: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: '700', color: colors.text },
  // Search stands out: filled with the brand colour
  searchButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  guest: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  guestIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  guestBody: { flex: 1, gap: 10, alignItems: 'flex-start' },
  guestText: { fontSize: 14, lineHeight: 20, color: colors.text },
  guestButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.primary },
  guestButtonText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700' },
  soon: { gap: 4, padding: 14, borderRadius: 14, backgroundColor: colors.cream, marginTop: 4 },
  soonTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  soonText: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  soonBold: { fontWeight: '700', color: colors.text },
  header: { gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6, zIndex: 20, elevation: 20 },
  place: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: colors.cream, maxWidth: 120 },
  placeOn: { backgroundColor: colors.primary },
  placeMain: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 7, paddingLeft: 10, paddingRight: 10, flexShrink: 1 },
  placeText: { fontSize: 13, fontWeight: '600', color: colors.text, flexShrink: 1 },
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
}));
