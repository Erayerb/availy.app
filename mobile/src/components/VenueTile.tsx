import { memo, useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Pressable } from './Pressable';

import { useCampaigns } from '../context/CampaignsContext';
import type { Venue } from '../lib/api';
import { colors, themed } from '../theme';
import { FavoriteButton } from './FavoriteButton';
import { StatusPill } from './StatusPill';
import { categoryLabel } from '../lib/filters';
import { sponsorsApi } from '../lib/sponsors';
import { VenuePhoto } from './VenuePhoto';
import { GradientFill } from './GradientFill';
import { Icon, InlineIcon } from './Icon';

type Props = {
  venue: Venue;
  size: number;
  distance?: string | null; // e.g. "850 m", shown when the user's location is known
  onPress: () => void;
  extra?: ReactNode; // under the heart (Favoriler: the zil)
};

// The photo is a little shorter than it is wide, so more venues fit on the screen
export const TILE_RATIO = 0.78;

function Tile({ venue, size, distance, onPress, extra }: Props) {
  // Sponsored cards count their views and taps for the business's numbers
  useEffect(() => {
    if (venue.sponsored) sponsorsApi.view(venue.id);
  }, [venue.sponsored, venue.id]);
  const press = () => {
    if (venue.sponsored) sponsorsApi.tap(venue.id);
    onPress();
  };
  const campaign = useCampaigns().activeFor(venue.id);

  return (
    <Pressable onPress={press} style={({ pressed }) => [{ width: size }, pressed && styles.pressed]}>
      <View>
        <VenuePhoto venueId={venue.id} category={venue.category} photoAt={venue.photo_at} size={size} height={Math.round(size * TILE_RATIO)} noScrim />
        {!venue.open_now && <View style={[styles.closedShade, { borderRadius: 16 }]} />}
        {/* A soft fade so the name on the card reads on any photo or colour */}
        <View style={[StyleSheet.absoluteFill, styles.fade]} pointerEvents="none">
          <GradientFill colors={['#000', '#000']} scrim />
        </View>
        <View style={styles.status}>
          <StatusPill venue={venue} onPhoto maxWidth={size - 52} />
        </View>
        {/* The name on the card, like the venue page's cover */}
        <View style={[styles.onCard, { maxWidth: size - 52 }]} pointerEvents="none">
          {campaign && venue.open_now && (
            <Text style={styles.campaign}><InlineIcon name="tag" /> {campaign.discount !== null ? `%${campaign.discount}` : 'Kampanya'}</Text>
          )}
          <Text style={styles.name} numberOfLines={2}>
            {venue.name}
          </Text>
        </View>
        {!!venue.moments && (
          <View style={styles.moments}>
            <Icon name="camera" size={12} color="#fff" />
            <Text style={styles.momentsText}>{venue.moments}</Text>
          </View>
        )}
        <View style={styles.favorite}>
          <FavoriteButton venueId={venue.id} size={16} floating />
          {extra}
        </View>
      </View>
      <Text style={styles.distance} numberOfLines={1}>
        {venue.sponsored && <Text style={styles.sponsored}>Sponsorlu · </Text>}
        {categoryLabel(venue.category)}
        {distance ? ` · ${distance}` : ''}
      </Text>
    </Pressable>
  );
}

/** Lists re-render often (a chip, a filter): a tile only when what it shows changed. */
export const VenueTile = memo(Tile, (a, b) => a.venue === b.venue && a.size === b.size && a.distance === b.distance && !a.extra && !b.extra);

const styles = themed(() => StyleSheet.create({
  pressed: { opacity: 0.75 },
  closedShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.closedShade },
  status: { position: 'absolute', top: 8, left: 8 },
  // Live photos: bottom left (the type's icon is bottom right); a campaign tag then sits above it
  // Live photos: top right, next to the heart (the name sits at the bottom)
  moments: {
    position: 'absolute',
    top: 8,
    right: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  momentsText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  fade: { borderRadius: 16, overflow: 'hidden' },
  onCard: { position: 'absolute', left: 10, bottom: 9, gap: 4 },
  campaign: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: colors.primary,
    color: colors.onPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  favorite: { position: 'absolute', top: 6, right: 6, gap: 6 },
  distance: { marginTop: 6, fontSize: 12, color: colors.textMuted },
  sponsored: { color: colors.gold, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '800', color: '#fff', lineHeight: 18 },
}));
