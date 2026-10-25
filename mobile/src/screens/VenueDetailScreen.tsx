import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '../components/BackButton';
import { BusinessRequest } from '../components/BusinessRequest';
import { CampaignBox } from '../components/CampaignBox';
import { FriendsHere } from '../components/FriendsHere';
import { FavoriteButton } from '../components/FavoriteButton';
import { CheckinPanel } from '../components/CheckinPanel';
import { CrowdDot } from '../components/CrowdDot';
import { VenuePhoto } from '../components/VenuePhoto';
import { WatchButton } from '../components/WatchButton';
import { useCampaigns } from '../context/CampaignsContext';
import { useEngagement } from '../context/EngagementContext';
import { useLoyalty } from '../context/LoyaltyContext';
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
import { crowdRatioText, crowdSummary, crowdYesterday } from '../lib/crowd';
import { shareVenue } from '../lib/shareVenue';
import { instagramUrl, phoneUrl } from '../lib/venueApi';
import { fetchTypical, typicalLines } from '../lib/typical';
import { canWatch } from '../lib/watch';
import { colors, themed } from '../theme';

type Props = {
  venueId: number;
  user: User | null; // for check-ins
  onRegister: () => void;
  onCheckedIn: () => void; // reload the user's points
  onLogin: () => void;
  onBack: () => void;
  onShowOnMap: (venue: Venue) => void;
  onOpenUser: (username: string) => void; // a reviewer's profile
  onEditProfile: () => void; // the venue's own business: Daha fazla > İşletme Profili
  lastCheckinAt?: string | null; // the user's last check-in here
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
  onEditProfile,
  lastCheckinAt = null,
}: Props) {
  const { venues, loading, error, refreshing, refresh } = useVenuesByIds([venueId]);
  const venue = venues[0];
  const { crowdLook } = useSettings();
  const { activeFor } = useCampaigns();
  const { watches } = useEngagement();
  const { programs, join, leave } = useLoyalty();
  const [loyaltyNote, setLoyaltyNote] = useState<string | null>(null);
  // "Genelde 18:00'de kalabalık", from past weeks' check-ins
  const [usually, setUsually] = useState<string[]>([]);
  useEffect(() => {
    fetchTypical(venueId)
      .then((t) => setUsually(typicalLines(t)))
      .catch(() => setUsually([]));
  }, [venueId]);
  // "👥 @ayse burada" is for registered customers
  const herePerson = user?.token && !user.isGuest && user.role !== 'business' ? user.token : null;
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
  // The venue's own business sees its page as customers do, with "Düzenle"
  const owner = user?.role === 'business' && user.venueId === venue.id;

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
          {owner && (
            <Pressable style={styles.edit} onPress={onEditProfile} hitSlop={6}>
              <Text style={styles.editText}>✏️ Düzenle</Text>
            </Pressable>
          )}
          {!owner && <WatchButton venue={venue} size={22} />}
          <Pressable
            onPress={async () => setNote(await shareVenue(venue))}
            hitSlop={10}
            accessibilityLabel="Paylaş"
          >
            <Text style={styles.icon}>⤴</Text>
          </Pressable>
          {!owner && <FavoriteButton venueId={venue.id} size={22} />}
        </View>
      </View>

      {owner && <Text style={styles.ownerNote}>👁 Müşteriler mekanını böyle görüyor</Text>}

      <VenuePhoto venueId={venue.id} category={venue.category} photoAt={venue.photo_at} size="100%" height={200} />

      <View>
        <Text style={styles.name}>
          {venue.name}
          {venue.verified && <Text style={styles.verified}> ✓</Text>}
        </Text>
        {venue.verified && <Text style={styles.verifiedText}>Doğrulanmış işletme</Text>}
        {venue.pending && (
          <Text style={styles.pending}>⏳ Onay bekliyor · bir kullanıcı ekledi; 3 farklı kişi check-in yapınca onaylanır</Text>
        )}
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
      {(venue.instagram || venue.phone) && (
        <View style={styles.links}>
          {venue.instagram && (
            <Pressable style={styles.linkButton} onPress={() => Linking.openURL(instagramUrl(venue.instagram!))}>
              <Text style={styles.linkText}>📷 @{venue.instagram}</Text>
            </Pressable>
          )}
          {venue.phone && (
            <Pressable style={styles.linkButton} onPress={() => Linking.openURL(phoneUrl(venue.phone!))}>
              <Text style={styles.linkText}>📞 Ara</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.row}>
          <CrowdDot venue={venue} size={14} />
          <Text style={styles.status}>{label}</Text>
          <Text style={styles.ratio}>
            {venue.open_now ? (crowdRatioText(venue.crowd) ?? '') : `${venue.opens_at}'de açılır`}
          </Text>
        </View>
        {venue.open_now && <Text style={styles.text}>{crowdSummary(venue.crowd, new Date())}</Text>}
        {venue.open_now && crowdYesterday(venue.crowd) && <Text style={styles.text}>🕘 {crowdYesterday(venue.crowd)}</Text>}
        <FriendsHere venueId={venue.id} token={herePerson} onOpenUser={onOpenUser} reloadKey={venue} />
        <Text style={styles.text}>🕒 {venue.hours}</Text>
        {usually.map((line) => (
          <Text key={line} style={styles.text}>
            📈 {line}
          </Text>
        ))}
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
          reloadReviews(); // a check-in allows two more reviews
          onCheckedIn();
        }}
        lastCheckinAt={lastCheckinAt}
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
          {program.member ? (
            <>
              <Text style={styles.text}>
                {program.kind === 'stamps'
                  ? `✓ Katıldın · kartında ${program.member.stamps}/${program.stampsRequired} damga${program.member.rewards ? ` · 🎁 ${program.member.rewards} ödül` : ''}`
                  : '✓ Üyesin'}
              </Text>
              <Text style={styles.muted}>Kasada QR'ını göster: Kampanyalar → Sadakat</Text>
              <Pressable onPress={() => leave(program.venueId)} hitSlop={6}>
                <Text style={styles.muted}>Programdan çık</Text>
              </Pressable>
            </>
          ) : user?.role !== 'business' ? (
            <Pressable style={styles.primary} onPress={async () => setLoyaltyNote(await join(program.venueId))}>
              <Text style={styles.primaryText}>{program.kind === 'stamps' ? 'Sadakat programına katıl' : `Üye ol (₺${program.price}/ay, demo)`}</Text>
            </Pressable>
          ) : null}
          {loyaltyNote && <Text style={styles.muted}>{loyaltyNote}</Text>}
        </View>
      )}

      {user?.role !== 'business' && <BusinessRequest venueId={venue.id} token={user?.token ?? null} onLogin={onLogin} />}

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

const styles = themed(() => StyleSheet.create({
  discovery: { fontSize: 13, color: colors.discovery, fontWeight: '600', marginTop: 2 },
  ownerNote: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  edit: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.primary },
  editText: { color: colors.onPrimary, fontWeight: '700', fontSize: 14 },
  verified: { color: colors.success, fontWeight: '800' },
  verifiedText: { fontSize: 13, color: colors.success, fontWeight: '600' },
  pending: { fontSize: 13, color: colors.gold, fontWeight: '600', marginTop: 2 },
  links: { flexDirection: 'row', gap: 10 },
  linkButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  linkText: { fontSize: 14, fontWeight: '700', color: colors.text },
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
}));

/** "@eray"; guests have no user name ("Misafir 12"); private first check-ins stay anonymous. */
function discoverer(discovery: { name: string | null; username?: string | null }): string {
  if (discovery.username) return `@${discovery.username}`;
  return discovery.name ?? 'gizli bir kullanıcı';
}
