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
import { colors, themed } from '../theme';

type Tab = 'saved' | 'visited';

type Props = {
  onOpenVenue: (venue: Venue) => void;
  // v2: venues the user checked in at
  visits: Visit[];
  signedIn: boolean; // favorites are for registered users only
  onLogin: () => void;
  onRegister: () => void;
};

export function FavoritesScreen({ onOpenVenue, visits, signedIn, onLogin, onRegister }: Props) {
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

  if (!signedIn) {
    return (
      <View style={styles.signedOut}>
        <View style={styles.topRow}>
          <Text style={styles.title}>Favoriler</Text>
          <HeaderButtons />
        </View>
        <Text style={styles.text}>Mekanları kaydetmek ve gittiğin yerleri görmek için giriş yap ya da kayıt ol.</Text>
        <Pressable style={styles.primary} onPress={onRegister}>
          <Text style={styles.primaryText}>Kayıt ol</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={onLogin}>
          <Text style={styles.secondaryText}>Giriş yap</Text>
        </Pressable>
      </View>
    );
  }

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

const styles = themed(() => StyleSheet.create({
  header: { gap: 12, marginBottom: 6 },
  signedOut: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 60, gap: 14 },
  text: { fontSize: 15, color: colors.text, lineHeight: 21 },
  primary: { paddingVertical: 13, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  secondary: { paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center' },
  secondaryText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.cream },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.text },
  tabTextActive: { color: colors.onPrimary },
}));
