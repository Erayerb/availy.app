import { StatusPill } from '../components/StatusPill';
import { Tip } from '../components/Tip';
import { GradientFill } from '../components/GradientFill';
import { InlineStars } from '../components/Stars';
import { MomentStack } from '../components/MomentStrip';
import { useEffect, useState } from 'react';
import { Linking, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { useOnPageFocus } from '../context/PageContext';
import { Text } from '../components/Text';
import { Pressable } from '../components/Pressable';

import { BackButton } from '../components/BackButton';
import { BusinessRequest } from '../components/BusinessRequest';
import { CampaignBox } from '../components/CampaignBox';
import { SalesPitch } from '../components/SalesPitch';
import { VenueRewardCard } from '../components/VenueRewardCard';
import { FriendsHere, VenueRegular } from '../components/FriendsHere';
import { AddToList } from '../components/AddToList';
import { Icon, InlineIcon } from '../components/Icon';
import { FavoriteButton } from '../components/FavoriteButton';
import { CheckinPanel } from '../components/CheckinPanel';
import { CrowdDot } from '../components/CrowdDot';
import { VenuePhoto } from '../components/VenuePhoto';
import { WatchButton } from '../components/WatchButton';
import { WrongInfo } from '../components/WrongInfo';
import { useCampaigns } from '../context/CampaignsContext';
import { useEngagement } from '../context/EngagementContext';
import { useLoyalty } from '../context/LoyaltyContext';
import { useLocation } from '../context/LocationContext';
import { useSettings } from '../context/SettingsContext';
import { PageSkeleton } from '../components/Skeleton';
import { useVenuesByIds } from '../hooks/useVenuesByIds';
import { venueIssuesApi } from '../lib/venueIssues';
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
import { crowdRatioText, crowdSummary, crowdYesterday, liveLevel } from '../lib/crowd';
import { shareVenue } from '../lib/shareVenue';
import { instagramUrl, phoneUrl } from '../lib/venueApi';
import { comparedToUsual, fetchTypical, typicalLines, usualNowText, type Typical } from '../lib/typical';
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
  onEditProfile: () => void; // the venue's own business: Daha fazla > İşletme profili
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
  const { venues, loading, error, refreshing, refresh, update } = useVenuesByIds([venueId]);
  const venue = venues[0];
  const { crowdLook } = useSettings();
  const { activeFor } = useCampaigns();
  const { watches } = useEngagement();
  const { programs, join, leave } = useLoyalty();
  const [loyaltyNote, setLoyaltyNote] = useState<string | null>(null);
  // "Genelde 18:00'de kalabalık", from past weeks' check-ins
  // and "Şu an normalden daha sakin" against this hour's usual level
  const [typical, setTypical] = useState<Typical | null>(null);
  useEffect(() => {
    fetchTypical(venueId)
      .then(setTypical)
      .catch(() => setTypical(null));
  }, [venueId]);
  const usually = typical ? typicalLines(typical) : [];
  // "👥 @ayse burada" is for registered customers
  const herePerson = user?.token && !user.isGuest && user.role !== 'business' ? user.token : null;
  const [listing, setListing] = useState(false);
  // v2: reviews and replies live on the server
  const { reviews, setReviews, reload: reloadReviews } = useReviews(venueId, user?.token);
  useOnPageFocus(() => {
    update();
    reloadReviews();
  });
  const writtenCount = reviews.items.filter((r) => r.body?.trim()).length;
  const { point } = useLocation();
  const [note, setNote] = useState<string | null>(null);

  if (!venue && loading) return <PageSkeleton />;
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
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
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
              <Text style={styles.editText}><InlineIcon name="pencil" /> Düzenle</Text>
            </Pressable>
          )}
          <Pressable onPress={async () => setNote(await shareVenue(venue))} hitSlop={10} accessibilityLabel="Paylaş">
            <Icon name="share-3" size={22} color={colors.text} />
          </Pressable>
          {!owner && <FavoriteButton venueId={venue.id} size={22} />}
        </View>
      </View>

      {owner && <Text style={styles.ownerNote}><InlineIcon name="eye" /> Müşteriler mekanını böyle görüyor</Text>}

      {/* Cover: the name and the crowd now on the photo, a dark fade under them */}
      <View style={styles.hero}>
        <VenuePhoto venueId={venue.id} category={venue.category} photoAt={venue.photo_at} size="100%" height={230} radius={20} />
        <View style={styles.heroFade} pointerEvents="none">
          <GradientFill colors={['#000', '#000']} scrim />
        </View>
        {/* Live photos: a fanned stack in the cover's corner */}
        <View style={styles.heroStack}>
          <MomentStack venueId={venue.id} token={user?.token ?? null} onOpenUser={onOpenUser} reloadKey={venue} />
        </View>
        <View style={styles.heroText} pointerEvents="none">
          <StatusPill venue={venue} onPhoto />
          <Text style={styles.heroName} numberOfLines={2}>
            {venue.name}
            {venue.verified && <Text> <InlineIcon name="circle-check" color="#fff" /></Text>}
          </Text>
          <Text style={styles.heroMeta} numberOfLines={1}>
            {categoryLabel(venue.category)} · {shortLocation(venue.neighborhood, venue.district)}
            {point ? ` · ${formatDistance(distanceKm(point, venue))}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.underCover}>
        {/* Top right of this block, over nothing: it never pushes the lines below */}
        {herePerson && !owner && (
          <View style={styles.wrongInfo}>
            <WrongInfo venueId={venue.id} venueName={venue.name} token={herePerson} />
          </View>
        )}
        {reviews.average !== null && (
          <Text style={styles.rating}>
            <InlineStars rating={Math.round(reviews.average)} /> {reviews.average.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}{' '}
            <Text style={styles.muted}>({reviews.count})</Text>
          </Text>
        )}
        {venue.founder && (
          <View style={styles.founderRow}>
            <Icon name="rosette" size={15} color={colors.gold} />
            <Text style={styles.founder}>Kurucu mekan</Text>
          </View>
        )}
        {user?.isAdmin && user.token && (
          <Pressable
            hitSlop={8}
            onPress={() =>
              venueIssuesApi
                .setFounder(user.token!, venue.id, !venue.founder)
                .then(() => {
                  setNote(null);
                  refresh();
                })
                .catch((e) => setNote(e instanceof Error ? e.message : 'Olmadı, tekrar dene.'))
            }
          >
            <Text style={styles.link}>{venue.founder ? 'Kurucu mekanlıktan çıkar' : 'Kurucu mekan yap'}</Text>
          </Pressable>
        )}
        {user?.isAdmin && user.token && <SalesPitch token={user.token} venueId={venue.id} />}
        {venue.pending && (
          <Text style={styles.pending}><InlineIcon name="hourglass" /> Onay bekliyor (kullanıcı tarafından eklendi; 3 check-in yapılırsa onaylanır)</Text>
        )}
        {venue.discovery && (
          <Text style={styles.discovery}>
            <InlineIcon name="sparkles" /> Burayı{' '}
            <Text
              style={styles.discoveryName}
              onPress={venue.discovery.username ? () => onOpenUser(venue.discovery!.username!) : undefined}
            >
              {discoverer(venue.discovery)}
            </Text>{' '}
            keşfetti ·{' '}
            {new Date(venue.discovery.at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
          </Text>
        )}
        {user?.role !== 'business' && <BusinessRequest venueId={venue.id} token={user?.token ?? null} onLogin={onLogin} />}
      </View>
      {note && <Text style={styles.note}>{note}</Text>}
      {/* Written by the venue's business */}
      {venue.address ? <Text style={styles.text}><InlineIcon name="map-pin" /> {venue.address}</Text> : null}
      {(venue.instagram || venue.phone) && (
        <View style={styles.links}>
          {venue.instagram && (
            <Pressable style={styles.linkButton} onPress={() => Linking.openURL(instagramUrl(venue.instagram!))}>
              <Text style={styles.linkText}><InlineIcon name="camera" /> @{venue.instagram}</Text>
            </Pressable>
          )}
          {venue.phone && (
            <Pressable style={styles.linkButton} onPress={() => Linking.openURL(phoneUrl(venue.phone!))}>
              <Text style={styles.linkText}><InlineIcon name="phone" /> Ara</Text>
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
        {/* Nothing live: what this hour is usually like here */}
        {venue.open_now && usualNowText(liveLevel(venue), typical?.usual_now) && (
          <Text style={styles.unusual}>{usualNowText(liveLevel(venue), typical?.usual_now)}</Text>
        )}
        {venue.open_now && crowdYesterday(venue.crowd) && <Text style={styles.text}><InlineIcon name="history" /> {crowdYesterday(venue.crowd)}</Text>}
        <FriendsHere venueId={venue.id} token={herePerson} onOpenUser={onOpenUser} reloadKey={venue} />
        <VenueRegular venueId={venue.id} token={herePerson} onOpenUser={onOpenUser} reloadKey={venue} />
        <Text style={styles.text}><InlineIcon name="clock" /> {venue.hours}</Text>
        {comparedToUsual(liveLevel(venue), typical?.usual_now) && (
          <Text style={styles.unusual}>{comparedToUsual(liveLevel(venue), typical?.usual_now)}</Text>
        )}
        {usually.map((line) => (
          <Text key={line} style={styles.text}>
            <InlineIcon name="chart-line" /> {line}
          </Text>
        ))}
        {/* Busy: "Sakin olunca haber ver" as a button with its words (stays on for 6 hours) */}
        {!owner && !canWatch(venue) && <WatchButton venue={venue} labeled />}
        {!owner && canWatch(venue) && (
          <Tip id="watchBell" placement="above" align="left" text="Burası şu an kalabalık. Zile bas: sakinleşince sana haber verelim." style={styles.tipLeft}>
            <WatchButton venue={venue} labeled />
          </Tip>
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
        onReviewsChange={(list) => (list ? setReviews(list) : reloadReviews())}
      />

      {/* Quiet labelled actions: not buttons that look like Check-in */}
      <View style={styles.quickRow}>
        <Pressable style={({ pressed }) => [styles.quick, pressed && styles.pressedDim]} onPress={() => onShowOnMap(venue)}>
          <Icon name="map-pin" size={16} color={colors.text} />
          <Text style={styles.quickText}>Haritada gör</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.quick, pressed && styles.pressedDim]}
          onPress={() => Linking.openURL(directionsUrl(Platform.OS, venue.lat, venue.lon))}
        >
          <Icon name="map" size={16} color={colors.text} />
          <Text style={styles.quickText}>Yol tarifi</Text>
        </Pressable>
        {herePerson && (
          <Pressable style={({ pressed }) => [styles.quick, pressed && styles.pressedDim]} onPress={() => setListing(true)}>
            <Icon name="bookmarks" size={16} color={colors.text} />
            <Text style={styles.quickText}>Listeye ekle</Text>
          </Pressable>
        )}
      </View>
      {campaign && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kampanya</Text>
          <CampaignBox campaign={campaign} />
        </View>
      )}
      {/* Renders nothing (no empty section) when the venue has no standing reward */}
      {user?.role !== 'business' && <VenueRewardCard venueId={venue.id} token={herePerson} onLogin={onLogin} style={styles.section} />}

      {program && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sadakat programı</Text>
          <View style={styles.loyalty}>
            <View style={styles.loyaltyHead}>
              <View style={styles.loyaltyIcon}>
                <GradientFill colors={['#5A3A12', '#C9962B']} />
                <Icon name="star" size={18} color="#fff" filled />
              </View>
              <Text style={[styles.text, styles.flex]}>{describeProgram(program)}</Text>
            </View>
            {program.member ? (
              <>
                {program.kind === 'stamps' ? (
                  <View style={styles.stampRow}>
                    {/* One dot per stamp on the card */}
                    {Array.from({ length: program.stampsRequired }, (_, i) => (
                      <View key={i} style={[styles.stamp, i < program.member!.stamps && styles.stampOn]}>
                        {i < program.member!.stamps && <Icon name="check" size={12} color={colors.onPrimary} />}
                      </View>
                    ))}
                  </View>
                ) : null}
                <Text style={styles.muted}>
                  {program.kind === 'stamps'
                    ? `${program.member.stamps}/${program.stampsRequired} damga${program.member.rewards ? ` · ${program.member.rewards} ödül hazır` : ''} · `
                    : 'Üyesin · '}
                  Kasada QR'ını göster (Kampanyalar → Sadakat)
                </Text>
                <Pressable onPress={() => leave(program.venueId)} hitSlop={6}>
                  <Text style={styles.leave}>Programdan çık</Text>
                </Pressable>
              </>
            ) : user?.role !== 'business' ? (
              <Pressable style={styles.primary} onPress={async () => setLoyaltyNote(await join(program.venueId))}>
                <Text style={styles.primaryText}>{program.kind === 'stamps' ? 'Sadakat programına katıl' : `Üye ol (₺${program.price}/ay)`}</Text>
              </Pressable>
            ) : null}
            {loyaltyNote && <Text style={styles.muted}>{loyaltyNote}</Text>}
          </View>
        </View>
      )}


      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Özellikler</Text>
        <View style={styles.wrap}>
          {amenitiesFor(venue).map((a) => (
            <Text key={a.label} style={styles.chip}>
              <InlineIcon name={a.icon} /> {a.label}
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

      {herePerson && (
        <AddToList token={herePerson} venueId={venue.id} venueName={venue.name} visible={listing} onClose={() => setListing(false)} />
      )}

      <Text style={styles.demo}>
        Mekan bilgileri © OpenStreetMap katkıcıları · doluluk kullanıcıların check-in'lerinden
      </Text>
    </ScrollView>
  );
}

const styles = themed(() => StyleSheet.create({
  tipLeft: { alignSelf: 'flex-start' },
  underCover: { minHeight: 26, gap: 4 },
  wrongInfo: { position: 'absolute', top: 0, right: 0, zIndex: 1 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quick: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 13, borderRadius: 14, backgroundColor: colors.cream },
  quickText: { fontSize: 14, fontWeight: '600', color: colors.text },
  hero: { borderRadius: 20, overflow: 'hidden' },
  heroFade: { ...StyleSheet.absoluteFill },
  heroStack: { position: 'absolute', top: 16, right: 18 },
  heroText: { position: 'absolute', left: 14, right: 14, bottom: 14, gap: 6 },
  heroName: { fontSize: 25, fontWeight: '800', color: '#fff' },
  heroMeta: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  heroActions: { flexDirection: 'row', gap: 8 },
  heroPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: 14, backgroundColor: colors.primary },
  heroPrimaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  heroIcon: { flexDirection: 'row', gap: 6, width: 52, height: 46, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  heroIconText: { fontSize: 15, fontWeight: '700', color: colors.text },
  pressedDim: { opacity: 0.8 },
  loyalty: { padding: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
  loyaltyHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  loyaltyIcon: { width: 40, height: 40, borderRadius: 11, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  stampRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stamp: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stampOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  leave: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '600', color: colors.textMuted, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 11, overflow: 'hidden', backgroundColor: colors.cream },
  discovery: { fontSize: 13, color: colors.discovery, fontWeight: '600', marginTop: 2 },
  discoveryName: { fontSize: 15, fontWeight: '800', color: colors.text },
  ownerNote: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  edit: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.primary },
  editText: { color: colors.onPrimary, fontWeight: '700', fontSize: 14 },
  verified: { color: colors.success, fontWeight: '800' },
  founderRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  founder: { fontSize: 13, fontWeight: '700', color: colors.gold },
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
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: TAB_BAR_SPACE, gap: 14 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.background,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  name: { fontSize: 24, fontWeight: '700', color: colors.text },
  flex: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
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
  unusual: { fontSize: 14, fontWeight: '700', color: colors.text },
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
  rating: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  ratingStars: { color: '#E0A800' },
  error: { fontSize: 13, color: colors.danger },
}));

/** "@eray"; guests have no user name ("Misafir 12"); private first check-ins stay anonymous. */
function discoverer(discovery: { name: string | null; username?: string | null }): string {
  if (discovery.username) return `@${discovery.username}`;
  return discovery.name ?? 'gizli bir kullanıcı';
}
