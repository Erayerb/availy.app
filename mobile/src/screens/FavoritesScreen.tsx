import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HeaderButtons } from '../components/HeaderButtons';
import { VenueGrid } from '../components/VenueGrid';
import { useFavorites } from '../context/FavoritesContext';
import { useLocation } from '../context/LocationContext';
import { sortByDistance } from '../lib/geo';
import { useVenuesByIds } from '../hooks/useVenuesByIds';
import type { Venue } from '../lib/api';
import type { Visit } from '../lib/checkinApi';
import { colors } from '../theme';

type Tab = 'saved' | 'visited';

type Props = {
  onOpenVenue: (venue: Venue) => void;
  // v2: venues the user checked in at
  visits: Visit[];
};

export function FavoritesScreen({ onOpenVenue, visits }: Props) {
  const [tab, setTab] = useState<Tab>('saved');
  const { ids: savedIds } = useFavorites();
  // Most recently visited first
  const visitedIds = [...visits].sort((a, b) => b.last_at.localeCompare(a.last_at)).map((v) => v.venue_id);
  const ids = tab === 'saved' ? savedIds : visitedIds;
  const { venues, loading, error, refreshing, refresh } = useVenuesByIds(ids);
  const { point } = useLocation();
  // Hide a venue right away when it is un-favorited, without waiting for a refetch
  const listed = venues.filter((v) => ids.includes(v.id));
  const visible =
    tab === 'saved'
      ? point
        ? sortByDistance(listed, point)
        : listed
      : [...listed].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Text style={styles.title}>Favoriler</Text>
        <HeaderButtons />
      </View>
      <View style={styles.tabs}>
        {(
          [
            { id: 'saved', label: `Kaydedilenler${savedIds.length ? ` (${savedIds.length})` : ''}` },
            { id: 'visited', label: `Ziyaret edilenler${visitedIds.length ? ` (${visitedIds.length})` : ''}` },
          ] as const
        ).map(({ id, label }) => (
          <Pressable
            key={id}
            onPress={() => setTab(id)}
            style={[styles.tab, tab === id && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === id }}
          >
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const empty =
    tab === 'saved'
      ? 'Henüz kaydettiğin mekan yok.\nMekanlardaki ♡ ile kaydedebilirsin.'
      : "Henüz check-in yapmadın.\nCheck-in yaptığın mekanlar burada görünür.";

  return (
    <VenueGrid
      venues={visible}
      header={header}
      emptyText={loading ? 'Yükleniyor…' : empty}
      error={error}
      onOpenVenue={onOpenVenue}
      refreshing={refreshing}
      onRefresh={refresh}
    />
  );
}

const styles = StyleSheet.create({
  header: { gap: 12, marginBottom: 6 },
  title: { fontSize: 26, fontWeight: '700' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.cream },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.text },
  tabTextActive: { color: colors.onPrimary },
});
