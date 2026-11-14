import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';

import { useLocation } from '../context/LocationContext';
import type { Venue } from '../lib/api';
import { categoryLabel } from '../lib/filters';
import { distanceKm, formatDistance } from '../lib/geo';
import { shortLocation } from '../lib/location';
import { colors, themed } from '../theme';
import { StatusPill } from './StatusPill';
import { VenuePhoto } from './VenuePhoto';
import { Pressable } from './Pressable';

type Props = { venue: Venue; onPress: () => void; action?: ReactNode };

/** One venue as a row: gradient thumbnail, name, type · place · distance, crowd now; `action` on the right (else ›). */
export function VenueRow({ venue, onPress, action }: Props) {
  const { point } = useLocation();
  const km = point ? distanceKm(point, venue) : null;
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <VenuePhoto venueId={venue.id} category={venue.category} photoAt={venue.photo_at} size={56} height={56} radius={14} centered />
      <View style={styles.flex}>
        <Text style={styles.name} numberOfLines={1}>
          {venue.name}
        </Text>
        <Text style={styles.muted} numberOfLines={1}>
          {categoryLabel(venue.category)} · {shortLocation(venue.neighborhood, venue.district)}
          {km !== null ? ` · ${formatDistance(km)}` : ''}
        </Text>
        <View style={styles.pill}>
          <StatusPill venue={venue} />
        </View>
      </View>
      {action ?? <Text style={styles.chevron}>›</Text>}
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flex: { flex: 1, gap: 2 },
  pill: { marginTop: 3 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  chevron: { fontSize: 22, color: colors.textMuted },
}));
