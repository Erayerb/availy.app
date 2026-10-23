import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCampaigns } from '../context/CampaignsContext';
import type { Venue } from '../lib/api';
import { colors, themed } from '../theme';
import { FavoriteButton } from './FavoriteButton';
import { CrowdDot } from './CrowdDot';
import { VenuePhoto } from './VenuePhoto';

type Props = {
  venue: Venue;
  size: number;
  distance?: string | null; // e.g. "850 m", shown when the user's location is known
  onPress: () => void;
};

export function VenueTile({ venue, size, distance, onPress }: Props) {
  const campaign = useCampaigns().activeFor(venue.id);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width: size }, pressed && styles.pressed]}>
      <View>
        <VenuePhoto venueId={venue.id} category={venue.category} photoAt={venue.photo_at} size={size} height={size} />
        {!venue.open_now && <View style={[styles.closedShade, { borderRadius: 16 }]} />}
        <View style={styles.badge}>
          <CrowdDot venue={venue} size={14} />
        </View>
        {!venue.open_now && <Text style={styles.closed}>Kapalı · {venue.opens_at}</Text>}
        {campaign && venue.open_now && (
          <Text style={styles.campaign}>🏷️ {campaign.discount !== null ? `%${campaign.discount}` : 'Kampanya'}</Text>
        )}
        <View style={styles.favorite}>
          <FavoriteButton venueId={venue.id} size={16} floating />
        </View>
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {venue.name}
      </Text>
      {distance && <Text style={styles.distance}>📍 {distance}</Text>}
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  pressed: { opacity: 0.75 },
  closedShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.closedShade },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.white,
  },
  closed: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.text,
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  campaign: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.primary,
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  favorite: { position: 'absolute', top: 6, left: 6 },
  distance: { marginTop: 2, fontSize: 12, color: colors.textMuted },
  name: { marginTop: 6, fontSize: 14, fontWeight: '600', color: colors.text },
}));
