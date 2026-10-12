import { Linking, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import type { Venue } from '../lib/api';
import { categoryLabel } from '../lib/filters';
import { directionsUrl, shortLocation } from '../lib/location';
import { areaStatus, formatRatio, levelStyle } from '../lib/occupancy';
import { FavoriteButton } from './FavoriteButton';
import { colors } from '../theme';

export const CARD_WIDTH = 250;

type Props = {
  venue: Venue;
  onClose: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};

/** Plain React Native view (not a map callout) so taps never reach other pins. */
export function VenueCard({ venue, onClose, onLayout }: Props) {
  const { color, label } = levelStyle(venue.occupancy.level);

  return (
    <View style={styles.card} onLayout={onLayout}>
      <View style={styles.header}>
        <Text style={styles.title}>{venue.name}</Text>
        <View style={styles.actions}>
          <FavoriteButton venueId={venue.id} />
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.category}>{categoryLabel(venue.category)}</Text>

      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.level}>{label}</Text>
        <Text style={styles.ratio}>{formatRatio(venue.occupancy.ratio)}</Text>
      </View>

      <Text style={styles.secondary}>{areaStatus(venue.district_occupancy.level)}</Text>
      <Text style={styles.secondary}>📍 {shortLocation(venue.neighborhood, venue.district)}</Text>

      <Pressable
        onPress={() => Linking.openURL(directionsUrl(Platform.OS, venue.lat, venue.lon))}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonText}>Yol tarifi</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    gap: 6,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  title: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  close: { fontSize: 16, color: colors.textMuted },
  category: { fontSize: 13, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  level: { fontSize: 14 },
  ratio: { fontSize: 14, color: colors.textMuted, marginLeft: 'auto' },
  secondary: { fontSize: 13, color: colors.textMuted },
  button: {
    marginTop: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: colors.onPrimary, fontWeight: '600' },
});
