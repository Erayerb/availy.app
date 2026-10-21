import { useState } from 'react';
import { Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '../components/BackButton';
import { CampaignBox } from '../components/CampaignBox';
import { FavoriteButton } from '../components/FavoriteButton';
import { CheckinPanel } from '../components/CheckinPanel';
import { CrowdDot } from '../components/CrowdDot';
import { VenuePhoto } from '../components/VenuePhoto';
import { WatchButton } from '../components/WatchButton';
import { useCampaigns } from '../context/CampaignsContext';
import { useEngagement } from '../context/EngagementContext';
import { useLocation } from '../context/LocationContext';
import { useSettings } from '../context/SettingsContext';
import { useVenuesByIds } from '../hooks/useVenuesByIds';
import { amenitiesFor } from '../lib/amenities';
import type { Venue } from '../lib/api';
import { categoryLabel } from '../lib/filters';
import { distanceKm, formatDistance } from '../lib/geo';
import { directionsUrl, shortLocation } from '../lib/location';
import { stars } from '../lib/feedback';
import { useReviews } from '../hooks/useReviews';
import { ReviewsSection } from '../components/ReviewsSection';
import { describeProgram, isProgramActive } from '../lib/loyalty';
import type { User } from '../lib/auth';
import { crowdExtra, crowdRatioText, crowdSummary } from '../lib/crowd';
import { shareVenue } from '../lib/shareVenue';
import { canWatch } from '../lib/watch';
import { colors } from '../theme';

type Props = {
  venueId: number;
  user: User | null; // for check-ins
  onRegister: () => void;
  onCheckedIn: () => void; // reload the user's points
  onLogin: () => void;
  onBack: () => void;
  onShowOnMap: (venue: Venue) => void;
  onOpenUser: (username: string) => void; // a reviewer's profile
};

export function VenueDetailScreen({
  venueId,
  user,
  onLogin,
  onRegister,
  onCheckedIn,
  onBack,
  onShowOnMap,
  onOpenUser,
}: Props) {
  const { venues, loading, error, refreshing, refresh } = useVenuesByIds([venueId]);
  const venue = venues[0];
  const { crowdLook } = useSettings();
  const { activeFor } = useCampaigns();
  const { programs, watches } = useEngagement();
  // v2: reviews and replies live on the server
  const { reviews, setReviews, reload: reloadReviews } = useReviews(venueId, user?.token);
  const { point } = useLocation();
  const [note, setNote] = useState<string | null>(null);

  if (!venue) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{error ?? (loading ? 'Yükleniyor…' : 'Mekan bulunamadı.')}</Text>
        <Pressable onPress={onBack}>
          <Text style={styles.link}>Geri dön</Text>
        </Pressable>
      </View>
    );
  }

  const { label } = crowdLook(venue);
  const campaign = venue.open_now ? activeFor(venue.id) : null;
  const program = programs.find((p) => p.venueId === venue.id && isProgramActive(p));
  const watching = watches.some((w) => w.venueId === venue.id);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={
        Platform.OS !== 'web' ? (
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        ) : undefined
      }
    >
      <View style={styles.top}>
        <BackButton onPress={onBack} />
        <View style={styles.actions}>
          <WatchButton venue={venue} size={22} />
          <Pressable
            onPress={async () => setNote(await shareVenue(venue))}
            hitSlop={10}
            accessibilityLabel="Paylaş"
          >
            <Text style={styles.icon}>⤴</Text>
          </Pressable>
          <FavoriteButton venueId={venue.id} size={22} />
        </View>
      </View>

      <VenuePhoto venueId={venue.id} category={venue.category} size="100%" height={200} />

      <View>
        <Text style={styles.name}>{venue.name}</Text>
        {venue.discovery && (
          <Text style={styles.discovery}>
            ✨ Burayı {discoverer(venue.discovery)} keşfetti ·{' '}
            {new Date(venue.discovery.at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
          </Text>
        )}
        {reviews.average !== null && (
          <Text style={styles.rating}>
            {stars(Math.round(reviews.average))} {reviews.average} · {reviews.count} yorum
          </Text>
        )}
        <Text style={styles.muted}>
          {categoryLabel(venue.category)} · {shortLocation(venue.neighborhood, venue.district)}
          {point ? ` · ${formatDistance(distanceKm(point, venue))}` : ''}
        </Text>
      </View>
      {note && <Text style={styles.note}>{note}</Text>}
      {venue.address ? <Text style={styles.text}>📍 {venue.address}</Text> : null}

      <View style={styles.card}>
        <View style={styles.row}>
          <CrowdDot venue={venue} size={14} />
          <Text style={styles.status}>{label}</Text>
          <Text style={styles.ratio}>
            {venue.open_now ? (crowdRatioText(venue.crowd) ?? '') : `${venue.opens_at}'de açılır`}
          </Text>
        </View>
        {venue.open_now && <Text style={styles.text}>{crowdSummary(venue.crowd, new Date())}</Text>}
        {venue.open_now && crowdExtra(venue.crowd) && <Text style={styles.text}>{crowdExtra(venue.crowd)}</Text>}
        <Text style={styles.text}>🕒 {venue.hours}</Text>
        {watching ? (
          <Text style={styles.watch}>🔔 Sakin olunca haber vereceğiz</Text>
        ) : (
          canWatch(venue) && (
            <Text style={styles.muted}>Kalabalık mı? 🔕 simgesine bas, sakinleşince haber verelim.</Text>
          )
        )}
      </View>

      <CheckinPanel
        venue={venue}
        user={user}
        onLogin={onLogin}
        onRegister={onRegister}
        onDone={() => {
          refresh();
          onCheckedIn();
        }}
      />

      <View style={styles.buttons}>
        <Pressable style={styles.secondary} onPress={() => onShowOnMap(venue)}>
          <Text style={styles.secondaryText}>Haritada gör</Text>
        </Pressable>
        <Pressable
          style={styles.primary}
          onPress={() => Linking.openURL(directionsUrl(Platform.OS, venue.lat, venue.lon))}
        >
          <Text style={styles.primaryText}>Yol tarifi</Text>
        </Pressable>
      </View>
      {campaign && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kampanya</Text>
          <CampaignBox campaign={campaign} />
        </View>
      )}

      {program && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sadakat programı</Text>
          <Text style={styles.text}>⭐ {describeProgram(program)}</Text>
          <Text style={styles.muted}>Ayrıntılar ve kartın: Kampanyalar → Sadakat</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Özellikler</Text>
        <View style={styles.wrap}>
          {amenitiesFor(venue).map((a) => (
            <Text key={a.label} style={styles.chip}>
              {a.icon} {a.label}
            </Text>
          ))}
        </View>
      </View>

      <ReviewsSection
        venueId={venue.id}
        user={user}
        reviews={reviews}
        onChange={setReviews}
        reload={reloadReviews}
        onRegister={onRegister}
        onOpenUser={onOpenUser}
      />

      <Text style={styles.demo}>
        Mekan bilgileri © OpenStreetMap katkıcıları · doluluk kullanıcıların check-in'lerinden
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  discovery: { fontSize: 13, color: '#7B5EA7', fontWeight: '600', marginTop: 2 },
  // Space for the status bar sits outside the scroll view, so the pull-to-refresh spinner stays visible
  page: { flex: 1, marginTop: 50, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 48, gap: 14 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.background,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  icon: { fontSize: 22, color: colors.textMuted },
  name: { fontSize: 24, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  link: { color: colors.primary, fontWeight: '600' },
  note: { fontSize: 13, color: colors.success },
  card: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { fontSize: 16, fontWeight: '600', color: colors.text },
  ratio: { marginLeft: 'auto', fontSize: 16, color: colors.textMuted },
  text: { fontSize: 14, color: colors.text },
  watch: { fontSize: 13, color: colors.primary },
  section: { gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.cream,
    color: colors.text,
    fontSize: 13,
  },
  buttons: { flexDirection: 'row', gap: 10 },
  primary: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  primaryText: { color: colors.onPrimary, fontWeight: '700' },
  secondary: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  secondaryText: { color: colors.primary, fontWeight: '700' },
  demo: { textAlign: 'center', fontSize: 12, color: colors.placeholder },
  rating: { fontSize: 14, color: colors.primary, marginTop: 2 },
  error: { fontSize: 13, color: colors.danger },
});

/** "@eray"; guests have no user name ("Misafir 12"); private first check-ins stay anonymous. */
function discoverer(discovery: { name: string | null; username?: string | null }): string {
  if (discovery.username) return `@${discovery.username}`;
  return discovery.name ?? 'gizli bir kullanıcı';
}
