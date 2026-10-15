import { StyleSheet, Text, View } from 'react-native';

import { VenueGrid } from '../components/VenueGrid';
import { useFavorites } from '../context/FavoritesContext';
import { useLocation } from '../context/LocationContext';
import { sortByDistance } from '../lib/geo';
import { useVenuesByIds } from '../hooks/useVenuesByIds';
import type { Venue } from '../lib/api';

type Props = {
  onOpenVenue: (venue: Venue) => void;
};

export function FavoritesScreen({ onOpenVenue }: Props) {
  const { ids } = useFavorites();
  const { venues, loading, error } = useVenuesByIds(ids);
  // Hide a venue right away when it is un-favorited, without waiting for a refetch
  const { point } = useLocation();
  const favorites = venues.filter((v) => ids.includes(v.id));
  const visible = point ? sortByDistance(favorites, point) : favorites;

  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>Favoriler</Text>
    </View>
  );

  return (
    <VenueGrid
      venues={visible}
      header={header}
      emptyText={loading ? 'Yükleniyor…' : 'Henüz favori mekanın yok.\nMekanlardaki ♡ ile ekleyebilirsin.'}
      error={error}
      onOpenVenue={onOpenVenue}
    />
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  title: { fontSize: 26, fontWeight: '700' },
});
