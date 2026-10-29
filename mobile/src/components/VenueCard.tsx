import { useState } from 'react';
import { Linking, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Text } from './Text';
import { Pressable } from './Pressable';

import { useCampaigns } from '../context/CampaignsContext';
import { useEngagement } from '../context/EngagementContext';
import { useLocation } from '../context/LocationContext';
import { useSettings } from '../context/SettingsContext';
import type { Venue } from '../lib/api';
import { categoryLabel } from '../lib/filters';
import { distanceKm, formatDistance } from '../lib/geo';
import { directionsUrl, shortLocation } from '../lib/location';
import { crowdRatioText, crowdSummary, crowdYesterday } from '../lib/crowd';
import { shareVenue } from '../lib/shareVenue';
import { colors, themed } from '../theme';
import { CampaignBox } from './CampaignBox';
import { FavoriteButton } from './FavoriteButton';
import { Icon, InlineIcon } from './Icon';
import { CrowdDot } from './CrowdDot';
import { FriendsHere } from './FriendsHere';
import { WatchButton } from './WatchButton';

export const CARD_WIDTH = 260;

type Props = {
  venue: Venue;
  friendsToken?: string | null; // "👥 @ayse burada" for registered customers
  onClose: () => void;
  onDetails: () => void;
  // Shown only for crowded venues: opens the quieter alternatives pop-up
  onShowAlternatives?: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};

/** Plain React Native view (not a map callout) so taps never reach other pins. */
export function VenueCard({ venue, friendsToken = null, onClose, onDetails, onShowAlternatives, onLayout }: Props) {
  const { crowdLook } = useSettings();
  const { label } = crowdLook(venue);
  const { activeFor } = useCampaigns();
  const { watches } = useEngagement();
  const campaign = venue.open_now ? activeFor(venue.id) : null;
  const { point } = useLocation();
  const [note, setNote] = useState<string | null>(null);
  const watching = watches.some((w) => w.venueId === venue.id);

  return (
    <View style={styles.card} onLayout={onLayout}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {venue.name}
          {venue.verified && <Text style={styles.verified}> ✓</Text>}
        </Text>
        <View style={styles.actions}>
          <WatchButton venue={venue} />
          <Pressable onPress={async () => setNote(await shareVenue(venue))} hitSlop={10} accessibilityLabel="Paylaş">
            <Icon name="share-3" size={20} color={colors.text} />
          </Pressable>
          <FavoriteButton venueId={venue.id} />
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.category}>{categoryLabel(venue.category)}</Text>
      <FriendsHere venueId={venue.id} token={friendsToken} />

      <View style={styles.row}>
        <CrowdDot venue={venue} />
        <Text style={styles.level}>{label}</Text>
        <Text style={styles.ratio}>
          {venue.open_now ? (crowdRatioText(venue.crowd) ?? '') : `${venue.opens_at}'de açılır`}
        </Text>
      </View>

      {venue.open_now && <Text style={styles.secondary}>{crowdSummary(venue.crowd, new Date())}</Text>}
      {venue.open_now && crowdYesterday(venue.crowd) && <Text style={styles.secondary}><InlineIcon name="history" /> {crowdYesterday(venue.crowd)}</Text>}
      {watching && <Text style={styles.watching}><InlineIcon name="bell" /> Sakin olunca haber vereceğiz</Text>}
      {campaign && <CampaignBox campaign={campaign} />}
      <Text style={styles.secondary}>
        <InlineIcon name="map-pin" /> {shortLocation(venue.neighborhood, venue.district)}
        {point ? ` · ${formatDistance(distanceKm(point, venue))}` : ''}
      </Text>
      {note && <Text style={styles.note}>{note}</Text>}

      {onShowAlternatives && venue.open_now && (
        <Pressable onPress={onShowAlternatives} style={({ pressed }) => [styles.altButton, pressed && styles.pressed]}>
          <Text style={styles.altButtonText}>Daha boş alternatifler</Text>
        </Pressable>
      )}

      <View style={styles.buttons}>
        <Pressable onPress={onDetails} style={({ pressed }) => [styles.detailsButton, pressed && styles.pressed]}>
          <Text style={styles.detailsText}>{venue.open_now ? <><InlineIcon name="map-pin" /> Check-in</> : 'Detaylar'}</Text>
        </Pressable>
        <Pressable
          onPress={() => Linking.openURL(directionsUrl(Platform.OS, venue.lat, venue.lon))}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>Yol tarifi</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  verified: { color: colors.success, fontWeight: '800' },
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
  title: { fontSize: 16, fontWeight: '600', flexShrink: 1, color: colors.text },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  close: { fontSize: 16, color: colors.textMuted },
  category: { fontSize: 13, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  level: { fontSize: 14, color: colors.text },
  ratio: { fontSize: 14, color: colors.textMuted, marginLeft: 'auto' },
  secondary: { fontSize: 13, color: colors.text },
  watching: { fontSize: 12, color: colors.primary },
  note: { fontSize: 12, color: colors.success },
  altButton: {
    marginTop: 4,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  altButtonText: { color: colors.primary, fontWeight: '600' },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 4 },
  detailsButton: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.cream, alignItems: 'center' },
  detailsText: { color: colors.text, fontWeight: '600' },
  button: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center' },
  pressed: { opacity: 0.8 },
  buttonText: { color: colors.onPrimary, fontWeight: '600' },
}));
