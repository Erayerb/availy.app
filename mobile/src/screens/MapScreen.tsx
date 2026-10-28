import { useCallback, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Pressable } from '../components/Pressable';

import { AlternativesPopup } from '../components/AlternativesPopup';
import { FilterBar } from '../components/FilterBar';
import { MapSearch } from '../components/MapSearch';
import { BackButton } from '../components/BackButton';
import { CARD_WIDTH, VenueCard } from '../components/VenueCard';
import { Icon } from '../components/Icon';
import { VenueMap } from '../components/VenueMap';
import { SELECTED_DOT_SIZE } from '../components/VenueMap.types';
import { useVenues } from '../hooks/useVenues';
import { useCampaigns } from '../context/CampaignsContext';
import { useLocation } from '../context/LocationContext';
import { quieterAlternatives, shouldSuggestAlternatives } from '../lib/alternatives';
import { campaignsNear } from '../lib/campaigns';
import { containsBounds, formatBBox, regionToBounds, type Region } from '../lib/bbox';
import { cardPosition, type Point } from '../lib/cardPosition';
import { trending } from '../lib/sort';
import { toggleTag, type Tag } from '../lib/filters';
import { LEVELS } from '../lib/occupancy';
import { CrowdDot } from '../components/CrowdDot';
import { LevelDot } from '../components/LevelDot';
import { UNEXPLORED } from '../lib/crowd';
import { useSettings } from '../context/SettingsContext';
import type { Venue } from '../lib/api';
import { colors, themed } from '../theme';

// Fetch an area twice the visible size so small pans don't trigger a new request
const QUERY_PADDING = 2;
// "Konumuma git" and "+" are the same size
const MAP_BUTTON = 52;
type Props = {
  onShowVenue: (venue: Venue) => void; // a searched venue: the map opens again around it, its card open
  friendsToken: string | null; // the map card shows friends who are there (registered customers)
  initialRegion: Region;
  onRegionSaved: (region: Region) => void;
  tags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  hideClosed: boolean;
  onHideClosedChange: (hide: boolean) => void;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  // Tapping the selected dot again closes its card
  onMarkerPress: (id: number) => void;
  onBack: () => void;
  onOpenDetails: (venue: Venue) => void;
  // v2: venues the user checked in at, for "Ziyaret ettiklerim"
  visitedIds: ReadonlySet<number>;
  // v2: the "+" button: nearest venues and search, to check in
  onOpenCheckin: () => void;
};

export function MapScreen({
  onShowVenue,
  friendsToken,
  initialRegion,
  onRegionSaved,
  tags,
  onTagsChange,
  hideClosed,
  onHideClosedChange,
  selectedId,
  onSelect,
  onMarkerPress,
  onBack,
  onOpenDetails,
  visitedIds,
  onOpenCheckin,
}: Props) {
  const [onlyVisited, setOnlyVisited] = useState(false);
  // 🔍 at the top: search a venue and move the map to it
  const [searching, setSearching] = useState(false);
  const [onlyTrending, setOnlyTrending] = useState(false);
  const anyFilter = tags.length > 0 || hideClosed || onlyTrending || onlyVisited;
  const clearFilters = () => {
    onTagsChange([]);
    onHideClosedChange(false);
    setOnlyVisited(false);
    setOnlyTrending(false);
  };
  const { look } = useSettings();
  const window = useWindowDimensions();
  const [queryBounds, setQueryBounds] = useState(() => regionToBounds(initialRegion, QUERY_PADDING));
  const [pinPoint, setPinPoint] = useState<Point | null>(null);
  const [cardHeight, setCardHeight] = useState(0);
  // Bottom edge of the back button + filter card; the venue card must stay below it
  const [headerBottom, setHeaderBottom] = useState(120);
  const { venues, error, lastUpdated } = useVenues(formatBBox(queryBounds), tags);
  const selected = venues.find((v) => v.id === selectedId);
  const [focus, setFocus] = useState<{ lat: number; lon: number; key: number } | null>(null);
  // Venue whose "Daha boş alternatifler" button was pressed; the pop-up hides when another venue is selected
  const [alternativesFor, setAlternativesFor] = useState<number | null>(null);
  const [popupHeight, setPopupHeight] = useState(0);

  const showPopup = selected !== undefined && alternativesFor === selected.id;
  const { campaigns, now, activeFor } = useCampaigns();
  const { point, locate } = useLocation();
  const [legendHeight, setLegendHeight] = useState(0);
  const [locateNote, setLocateNote] = useState<string | null>(null);

  const goToMyLocation = async () => {
    const position = point ? { coords: point, error: null } : await locate();
    if (position.coords) {
      setLocateNote(null);
      setFocus({ lat: position.coords.lat, lon: position.coords.lon, key: Date.now() });
    } else {
      setLocateNote(
        position.error === 'blocked'
          ? 'Konum izni kapalı. Ayarlar > availy > Konum\'dan açabilirsin.'
          : 'Konumun alınamadı.',
      );
      setTimeout(() => setLocateNote(null), 4000);
    }
  };
  // Campaigns whose radius reaches the user (or, without a location, the crowded venue they are looking at)
  const campaignIds = showPopup
    ? new Set(campaignsNear(campaigns, point ?? selected, now).map(({ campaign }) => campaign.venueId))
    : new Set<number>();
  const alternatives = showPopup ? quieterAlternatives(selected, venues, campaignIds) : [];

  const handlePointChange = useCallback((point: Point | null) => setPinPoint(point), []);

  const handleRegionChangeComplete = (region: Region) => {
    onRegionSaved(region);
    if (!containsBounds(queryBounds, regionToBounds(region))) {
      setQueryBounds(regionToBounds(region, QUERY_PADDING));
    }
  };

  const cardTopLeft =
    selected && pinPoint && cardHeight > 0
      ? cardPosition({
          pin: pinPoint,
          card: { width: CARD_WIDTH, height: cardHeight },
          // Keep the venue card above the pop-up, or above the legend at the bottom
          screen: { width: window.width, height: window.height - (showPopup ? popupHeight : legendHeight) - 36 },
          topInset: headerBottom + 8,
          margin: 8,
          pinHeight: SELECTED_DOT_SIZE / 2 + 4,
        })
      : null;

  return (
    <View style={styles.container}>
      <VenueMap
        initialRegion={initialRegion}
        venues={(onlyTrending ? trending(venues) : venues).filter(
          (v) => (!hideClosed || v.open_now) && (!onlyVisited || visitedIds.has(v.id)),
        )}
        selectedId={selectedId}
        onMarkerPress={onMarkerPress}
        onMapPress={() => onSelect(null)}
        onRegionChangeComplete={handleRegionChangeComplete}
        onSelectedPointChange={handlePointChange}
        focus={focus}
        userPoint={point}
      />

      {/* Jump to the user's own position; asks for permission again if it was not given */}
      <Pressable
        style={[styles.locate, { bottom: (showPopup ? popupHeight : legendHeight) + 48 }]}
        onPress={goToMyLocation}
        accessibilityLabel="Konumuma git"
      >
        <Icon name="locate" size={24} color="#1A73E8" />
      </Pressable>
      {/* Check in: nearest venues and a search */}
      <Pressable
        style={[styles.checkinButton, { bottom: (showPopup ? popupHeight : legendHeight) + 48 }]}
        onPress={onOpenCheckin}
        accessibilityLabel="Check-in yap"
      >
        <Text style={styles.checkinIcon}>+</Text>
      </Pressable>
      {locateNote && (
        <Text style={[styles.locateNote, { bottom: (showPopup ? popupHeight : legendHeight) + 56 }]}>{locateNote}</Text>
      )}

      {selected && (
        <View
          style={[
            styles.cardContainer,
            cardTopLeft ? { left: cardTopLeft.x, top: cardTopLeft.y } : styles.cardMeasuring,
          ]}
        >
          <VenueCard
            venue={selected}
            friendsToken={friendsToken}
            onClose={() => onSelect(null)}
            onDetails={() => onOpenDetails(selected)}
            onShowAlternatives={
              shouldSuggestAlternatives(selected) ? () => setAlternativesFor(selected.id) : undefined
            }
            onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}
          />
        </View>
      )}

      {showPopup && selected ? (
        <AlternativesPopup
          venue={selected}
          alternatives={alternatives}
          campaignFor={activeFor}
          onChoose={(alt) => {
            onSelect(alt.id);
            setFocus({ lat: alt.lat, lon: alt.lon, key: Date.now() });
          }}
          onClose={() => setAlternativesFor(null)}
          onLayout={(e) => setPopupHeight(e.nativeEvent.layout.height)}
        />
      ) : (
        <View style={styles.legend} onLayout={(e) => setLegendHeight(e.nativeEvent.layout.height)}>
          <View style={styles.modeRow}>
            {[
              { visited: false, label: 'Tümü' },
              { visited: true, label: `📍 Ziyaret ettiklerim${visitedIds.size ? ` (${visitedIds.size})` : ''}` },
            ].map(({ visited, label }) => (
              <Pressable
                key={label}
                onPress={() => setOnlyVisited(visited)}
                style={[styles.mode, onlyVisited === visited && styles.modeActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: onlyVisited === visited }}
              >
                <Text style={[styles.modeText, onlyVisited === visited && styles.modeTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {onlyTrending && trending(venues).length === 0 && (
            <Text style={styles.status}>Son 24 saatte bu bölgede check-in yok. Haritayı kaydır ya da sonra bak.</Text>
          )}
          {onlyVisited && visitedIds.size === 0 && (
            <Text style={styles.status}>Henüz check-in yapmadın. Check-in yaptığın mekanlar burada görünür.</Text>
          )}
          {LEVELS.map((level) => (
            <View key={level} style={styles.legendItem}>
              <LevelDot level={level} />
              <Text style={styles.legendText}>{look(level).label}</Text>
            </View>
          ))}
          <View style={styles.legendItem}>
            <LevelDot level="low" open={false} />
            <Text style={styles.legendText}>Kapalı</Text>
          </View>
          {/* Never checked in: on its own line under the others */}
          <View style={styles.legendBreak} />
          <View style={styles.legendItem}>
            <CrowdDot venue={{ open_now: true, crowd: UNEXPLORED }} />
            <Text style={styles.legendText}>Keşfedilmedi</Text>
          </View>
          <Text style={error ? styles.error : styles.status}>
            {error ??
              (lastUpdated
                ? lastUpdated.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                : '…')}
          </Text>
        </View>
      )}

      <View
        style={styles.header}
        // Empty space around the buttons still lets the map be dragged
        pointerEvents="box-none"
        onLayout={(e) => setHeaderBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
      >
        <View style={styles.topBar} pointerEvents="box-none">
          <BackButton onPress={onBack} />
          <Pressable style={styles.search} onPress={() => setSearching(true)} accessibilityLabel="Mekan ara">
            <Text style={styles.searchText}>🔍 Mekan ara</Text>
          </Pressable>
          {anyFilter && (
            <Pressable style={styles.clear} onPress={clearFilters} accessibilityLabel="Filtreleri temizle">
              <Text style={styles.clearText}>✕ Temizle</Text>
            </Pressable>
          )}
        </View>
        {/* Filters right under the back button, edge to edge */}
        <FilterBar
          selected={tags}
          onToggle={(tag) => onTagsChange(toggleTag(tags, tag))}
          hideClosed={hideClosed}
          onHideClosedChange={onHideClosedChange}
          onlyTrending={onlyTrending}
          onOnlyTrendingChange={setOnlyTrending}
        />
      </View>

      {searching && (
        <MapSearch
          onClose={() => setSearching(false)}
          onChoose={(venue) => {
            setSearching(false);
            onShowVenue(venue);
          }}
        />
      )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: 'absolute',
    top: 56,
    left: 0,
    // The pill row runs from edge to edge and scrolls under them
    right: 0,
    gap: 6,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, gap: 10 },
  search: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  searchText: { fontSize: 15, color: colors.textMuted },
  clear: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    backgroundColor: colors.primary,
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  clearText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  modeRow: { width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 2 },
  mode: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.cream },
  modeActive: { backgroundColor: colors.primary },
  modeText: { fontSize: 13, fontWeight: '600', color: colors.text },
  modeTextActive: { color: colors.onPrimary },
  cardContainer: { position: 'absolute' },
  cardMeasuring: { left: 0, top: 0, opacity: 0 },
  legend: {
    position: 'absolute',
    bottom: 36,
    left: 12,
    right: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    rowGap: 6,
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  locate: {
    position: 'absolute',
    left: 14,
    width: MAP_BUTTON,
    height: MAP_BUTTON,
    borderRadius: MAP_BUTTON / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  checkinButton: {
    position: 'absolute',
    right: 14,
    width: MAP_BUTTON,
    height: MAP_BUTTON,
    borderRadius: MAP_BUTTON / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  checkinIcon: { fontSize: 32, lineHeight: 34, color: colors.onPrimary, fontWeight: '500' },
  locateNote: {
    position: 'absolute',
    left: 14 + MAP_BUTTON + 8,
    right: 14 + MAP_BUTTON + 8,
    padding: 8,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    fontSize: 12,
    color: colors.text,
  },
  legendBreak: { width: '100%', height: 0 },
  legendText: { fontSize: 12, color: colors.text },
  dot: { width: 10, height: 10, borderRadius: 5 },
  status: { fontSize: 11, color: colors.textMuted },
  error: { fontSize: 11, color: colors.danger, maxWidth: 140 },
}));
