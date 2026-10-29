import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';

import { useLocation } from '../context/LocationContext';
import { useSettings } from '../context/SettingsContext';
import type { Venue } from '../lib/api';
import { categoryLabel } from '../lib/filters';
import { distanceKm, formatDistance } from '../lib/geo';
import { shortLocation } from '../lib/location';
import { colors, themed } from '../theme';
import { CrowdDot } from './CrowdDot';
import { Pressable } from './Pressable';

type Props = { venue: Venue; onPress: () => void; action?: ReactNode };

/** One venue as a row: crowd dot, name, type · place · distance, crowd now; `action` on the right (else ›). */
export function VenueRow({ venue, onPress, action }: Props) {
  const { point } = useLocation();
  const { crowdLook } = useSettings();
  const km = point ? distanceKm(point, venue) : null;
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <CrowdDot venue={venue} size={14} />
      <View style={styles.flex}>
        <Text style={styles.name} numberOfLines={1}>
          {venue.name}
        </Text>
        <Text style={styles.muted} numberOfLines={1}>
          {categoryLabel(venue.category)} · {shortLocation(venue.neighborhood, venue.district)}
          {km !== null ? ` · ${formatDistance(km)}` : ''}
        </Text>
        <Text style={styles.muted}>{venue.open_now ? crowdLook(venue).label : 'Kapalı'}</Text>
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
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flex: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  chevron: { fontSize: 22, color: colors.textMuted },
}));
