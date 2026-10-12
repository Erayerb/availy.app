import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MenuButton } from '../components/MenuButton';
import { VenueTile } from '../components/VenueTile';
import { useCampaigns } from '../context/CampaignsContext';
import { useLocation } from '../context/LocationContext';
import { useSearch } from '../hooks/useSearch';
import type { Venue } from '../lib/api';
import { visibleCampaigns } from '../lib/campaigns';
import { distanceKm, formatDistance } from '../lib/geo';
import { byQuietest } from '../lib/sort';
import { colors } from '../theme';

const TILE = 140;
const PER_ROW = 10;

type Props = {
  onMenu: () => void;
  onOpenVenue: (venue: Venue) => void;
};

/** Ready-made lists: quietest right now, nearby campaigns, places to work, places to eat. */
export function ExploreScreen({ onMenu, onOpenVenue }: Props) {
  const { venues, loading, error } = useSearch('', null, []);
  const { campaigns, now } = useCampaigns();
  const { point } = useLocation();

  const sections = useMemo(() => {
    const open = venues.filter((v) => v.open_now);
    const campaignIds = new Set(visibleCampaigns(campaigns, point, now).map(({ campaign }) => campaign.venueId));
    return [
      { title: 'Şu an en sakin', subtitle: 'Açık ve boş yer olan mekanlar', items: byQuietest(open) },
      { title: 'Kampanyası olanlar', subtitle: 'Şu an indirim yapan mekanlar', items: open.filter((v) => campaignIds.has(v.id)) },
      {
        title: 'Çalışmak için',
        subtitle: 'Sessiz ve co-working uygun, kalabalık değil',
        items: byQuietest(open.filter((v) => v.tags.some((t) => t === 'quiet' || t === 'coworking') && v.occupancy.level !== 'high')),
      },
      { title: 'Yemek için', subtitle: 'Açık restoranlar', items: byQuietest(open.filter((v) => v.tags.includes('food'))) },
      { title: 'Akşam için', subtitle: 'Eğlence ve sosyalleşme', items: byQuietest(open.filter((v) => v.tags.includes('entertainment'))) },
    ]
      .map((s) => ({ ...s, items: s.items.slice(0, PER_ROW) }))
      .filter((s) => s.items.length > 0);
  }, [venues, campaigns, point, now]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.top}>
        <MenuButton onPress={onMenu} />
        <Text style={styles.title}>Keşfet</Text>
      </View>
      {(loading || error) && <Text style={styles.muted}>{error ?? 'Yükleniyor…'}</Text>}
      {!loading && sections.length === 0 && <Text style={styles.muted}>Şu an açık mekan yok.</Text>}
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.muted}>{section.subtitle}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {section.items.map((venue) => (
              <VenueTile
                key={venue.id}
                venue={venue}
                size={TILE}
                distance={point ? formatDistance(distanceKm(point, venue)) : null}
                onPress={() => onOpenVenue(venue)}
              />
            ))}
          </ScrollView>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 60, paddingBottom: 40, gap: 22 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  section: { gap: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, paddingHorizontal: 16 },
  muted: { fontSize: 13, color: colors.textMuted, paddingHorizontal: 16 },
  row: { gap: 12, paddingHorizontal: 16, paddingTop: 8 },
});
