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
import { VenuePhoto } from './VenuePhoto';
import { WatchButton } from './WatchButton';

export const CARD_WIDTH = 320;

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
      {/* Photo and name side by side (the name centred on the photo); watch, share, favourite and close on the right */}
      <View style={styles.header}>
        <Pressable onPress={onDetails} style={({ pressed }) => [styles.headerMain, pressed && styles.pressed]} accessibilityRole="link">
          <VenuePhoto venueId={venue.id} category={venue.category} photoAt={venue.photo_at} size={56} height={56} radius={14} centered />
          <View style={styles.titleBox}>
            <Text style={styles.title} numberOfLines={2}>
              {venue.name}
              {venue.verified && <Text style={styles.verified}> <InlineIcon name="circle-check" color={colors.primary} /></Text>}
            </Text>
            <Text style={styles.category} numberOfLines={1}>
              {categoryLabel(venue.category)}
              {point ? ` · ${formatDistance(distanceKm(point, venue))}` : ''}
            </Text>
          </View>
        </Pressable>
        <View style={styles.actions}>
          <WatchButton venue={venue} size={18} />
          <Pressable onPress={async () => setNote(await shareVenue(venue))} hitSlop={8} accessibilityLabel="Paylaş">
            <Icon name="share-3" size={18} color={colors.text} />
          </Pressable>
          <FavoriteButton venueId={venue.id} size={18} />
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Kapat">
            <Icon name="x" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>
      {venue.founder && (
        <View style={styles.founderRow}>
          <Icon name="rosette" size={14} color={colors.gold} />
          <Text style={styles.founder}>Kurucu mekan</Text>
        </View>
      )}
      <FriendsHere venueId={venue.id} token={friendsToken} />

      {/* The crowd now, with the live photos at the end of the line */}
      <View style={styles.row}>
        <CrowdDot venue={venue} />
        <Text style={styles.level} numberOfLines={1}>{label}</Text>
        <Text style={[styles.ratio, styles.flex]} numberOfLines={1}>
          {venue.open_now ? (crowdRatioText(venue.crowd) ?? '') : `${venue.opens_at}'de açılır`}
        </Text>
        {venue.moments ? (
          <Pressable onPress={onDetails} hitSlop={8} style={styles.moments} accessibilityLabel={`${venue.moments} canlı fotoğraf`}>
            <Icon name="camera" size={13} color={colors.onPrimary} />
            <Text style={styles.momentsText}>{venue.moments}</Text>
          </Pressable>
        ) : null}
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
  founderRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  founder: { fontSize: 12, fontWeight: '700', color: colors.gold },
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
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  headerMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  titleBox: { flex: 1, minWidth: 0, gap: 2 },
  closeButton: { position: 'absolute', top: 14, right: 14, zIndex: 2 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  moments: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: colors.primary },
  chevron: { fontSize: 22, color: colors.placeholder },
  flex: { flex: 1 },
  momentsText: { color: colors.onPrimary, fontWeight: '800', fontSize: 12 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingTop: 2 },
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
