import { BackButton } from '../components/BackButton';
import { HeaderButtons } from '../components/HeaderButtons';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '../components/Pressable';

import { CampaignBox } from '../components/CampaignBox';
import { CampaignForm } from '../components/business/CampaignForm';
import { CouponVerifier } from '../components/business/CouponVerifier';
import { LoyaltySetup } from '../components/business/LoyaltySetup';
import { ScheduleSection } from '../components/business/ScheduleSection';
import { Chip } from '../components/TagChips';
import { useCampaigns } from '../context/CampaignsContext';
import { useLoyalty } from '../context/LoyaltyContext';
import { useLocation } from '../context/LocationContext';
import { isActive, repeatCampaign, timeLeft, visibleCampaigns, type Campaign } from '../lib/campaigns';
import { useVenuesByIds } from '../hooks/useVenuesByIds';
import { couponQrPayload, couponValid } from '../lib/coupons';
import { campaignTotals } from '../lib/campaigns';
import { distanceKm, formatDistance } from '../lib/geo';
import type { PlanId } from '../lib/plans';
import QRCode from 'react-native-qrcode-svg';

import { availyPoints, customerQrPayload, describeProgram } from '../lib/loyalty';
import { colors, themed } from '../theme';

export type Tab = 'campaigns' | 'coupons' | 'loyalty' | 'myCampaigns' | 'myPrograms' | 'venueCoupons' | 'rivals';

// Campaigns, coupons and loyalty share one bottom tab
const CUSTOMER_TABS: { tab: Tab; label: string }[] = [
  { tab: 'campaigns', label: 'Kampanyalar' },
  { tab: 'coupons', label: 'Kuponlarım' },
  { tab: 'loyalty', label: 'Sadakat' },
];

// A business sees its own campaigns, coupons and loyalty program, plus its rivals' campaigns
const BUSINESS_TABS: { tab: Tab; label: string }[] = [
  { tab: 'myCampaigns', label: 'Kampanyalarım' },
  { tab: 'venueCoupons', label: 'Kuponlar' },
  { tab: 'myPrograms', label: 'Sadakat programım' },
  { tab: 'rivals', label: 'Rakipler' },
];

// "Rakipler": active campaigns of other venues this close to the business
const RIVAL_RADIUS_KM = 3;

export type BusinessInfo = {
  venueId: number;
  plan: PlanId;
  onPlanChange: (plan: PlanId) => void;
};

type Props = {
  signedIn: boolean;
  serverPoints: number; // v2: points from check-ins
  customerCode: string | null; // loyalty QR ("M-123456", from the server)
  business: BusinessInfo | null; // set for business accounts
  onLogin: () => void;
  onOpenVenue: (campaign: Pick<Campaign, 'venueId' | 'lat' | 'lon'>) => void;
  // Set when opened from "Daha fazla" (customers); businesses have it as a tab
  onBack?: () => void;
  initialTab?: Tab; // e.g. "myPrograms" from Müşteriler
  onTabChange?: (tab: Tab) => void; // remembered, so back from a venue returns to this tab
};

export function CampaignsScreen({ signedIn, serverPoints, customerCode, business, onLogin, onOpenVenue, onBack, initialTab, onTabChange }: Props) {
  const tabs = business ? BUSINESS_TABS : CUSTOMER_TABS;
  const [tab, setTabState] = useState<Tab>(initialTab && tabs.some((t) => t.tab === initialTab) ? initialTab : tabs[0].tab);
  const setTab = (next: Tab) => {
    setTabState(next);
    onTabChange?.(next);
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        {onBack && <BackButton onPress={onBack} />}
        <Text style={[styles.title, styles.flex]}>Kampanyalar ve Sadakat</Text>
        {!onBack && <HeaderButtons />}
      </View>
      <View style={styles.tabs}>
        {tabs.map(({ tab: t, label }) => (
          <Chip key={t} label={label} active={tab === t} onPress={() => setTab(t)} />
        ))}
      </View>
      {tab === 'campaigns' && <CampaignList onOpenVenue={onOpenVenue} />}
      {tab === 'coupons' && <MyCoupons />}
      {tab === 'loyalty' && <Loyalty signedIn={signedIn} serverPoints={serverPoints} customerCode={customerCode} onLogin={onLogin} />}
      {tab === 'myCampaigns' && business && <MyCampaigns business={business} />}
      {tab === 'myPrograms' && business && <MyPrograms />}
      {tab === 'venueCoupons' && business && <VenueCoupons venueId={business.venueId} />}
      {tab === 'rivals' && business && <Rivals venueId={business.venueId} />}
    </ScrollView>
  );
}

function CampaignList({ onOpenVenue }: Pick<Props, 'onOpenVenue'>) {
  const { campaigns, now, recordView } = useCampaigns();
  const location = useLocation();
  // Campaigns of v1 demo venues stay stored on the phone but are not shown in v2
  const { venues: shownVenues } = useVenuesByIds([...new Set(campaigns.map((c) => c.venueId))]);
  const shownIds = new Set(shownVenues.map((v) => v.id));
  const nearby = visibleCampaigns(campaigns, location.point, now).filter(({ campaign }) => shownIds.has(campaign.venueId));

  // Count each shown campaign as a view (business statistics)
  useEffect(() => {
    nearby.forEach(({ campaign }) => recordView(campaign.id));
  }, [nearby.map(({ campaign }) => campaign.id).join(','), recordView]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.list}>
      <Text style={styles.muted}>
        {location.loading
          ? 'Konum alınıyor…'
          : location.point
            ? 'Konumuna ulaşan aktif kampanyalar'
            : 'Konum kullanılamadı; tüm aktif kampanyalar gösteriliyor'}
      </Text>
      {nearby.length === 0 && (
        <Text style={styles.empty}>
          Yakınında şu an aktif kampanya yok. Mekanlar kampanya başlatınca burada görünür.
        </Text>
      )}
      {nearby.map(({ campaign, distanceKm }) => (
        <View key={campaign.id} style={styles.card}>
          <Pressable onPress={() => onOpenVenue(campaign)} style={styles.cardHeader}>
            <Text style={styles.venue} numberOfLines={1}>
              {campaign.venueName}
            </Text>
            {campaign.discount !== null && <Text style={styles.badge}>%{campaign.discount}</Text>}
          </Pressable>
          <CampaignBox campaign={campaign} />
          <Pressable onPress={() => onOpenVenue(campaign)}>
            <Text style={styles.muted}>
              {distanceKm !== null ? `📍 ${formatDistance(distanceKm)} · ` : ''}Haritada gör ›
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function MyCoupons() {
  const { coupons: mine, now } = useCampaigns();

  return (
    <View style={styles.list}>
      {mine.length === 0 && (
        <Text style={styles.empty}>Henüz kuponun yok. Kampanyalardan "Kuponu al"a dokun.</Text>
      )}
      {mine.map((coupon) => {
        const status = coupon.redeemedAt ? 'Kullanıldı' : couponValid(coupon, now) ? 'Geçerli · kasada göster' : 'Süresi doldu';
        return (
          <View key={coupon.code} style={[styles.card, status !== 'Geçerli · kasada göster' && styles.faded]}>
            <Text style={styles.venue}>{coupon.venueName}</Text>
            <Text style={styles.text}>{coupon.message}</Text>
            {status === 'Geçerli · kasada göster' && (
              <View style={styles.qr}>
                <QRCode
                  value={couponQrPayload(coupon.code)}
                  size={140}
                  backgroundColor={colors.surface}
                  color={colors.text}
                />
              </View>
            )}
            <View style={styles.codeRow}>
              <Text style={styles.code}>{coupon.code}</Text>
              <Text style={styles.muted}>{status}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Loyalty({
  signedIn,
  serverPoints,
  customerCode,
  onLogin,
}: {
  signedIn: boolean;
  serverPoints: number;
  customerCode: string | null;
  onLogin: () => void;
}) {
  const { programs, join, leave } = useLoyalty();
  const { coupons } = useCampaigns();
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <View style={styles.list}>
        <Text style={styles.empty}>Sadakat programlarına katılmak ve availy puanı kazanmak için giriş yap.</Text>
        <Pressable style={styles.primary} onPress={onLogin}>
          <Text style={styles.primaryText}>Giriş yap</Text>
        </Pressable>
      </View>
    );
  }

  const stampsCollected = programs.reduce((sum, p) => sum + (p.member?.totalStamps ?? 0), 0);
  const couponsUsed = coupons.filter((c) => c.redeemedAt).length;
  // The ones I joined first
  const sorted = [...programs].sort((a, b) => Number(!!b.member) - Number(!!a.member));

  return (
    <View style={styles.list}>
      <View style={styles.pointsCard}>
        <Text style={styles.pointsLabel}>availy puanın</Text>
        <Text style={styles.points}>{serverPoints + availyPoints(stampsCollected, couponsUsed)}</Text>
        <Text style={styles.muted}>
          Her check-in 10, bir mekanın ilk check-in'i +50; her damga 5, kullandığın her kupon 10 puan.
        </Text>
        {customerCode && (
          <>
            <View style={styles.qr}>
              <QRCode value={customerQrPayload(customerCode)} size={170} backgroundColor={colors.cream} color={colors.text} />
            </View>
            <Text style={[styles.text, styles.centered]}>
              <Text style={styles.code}>{customerCode}</Text>
            </Text>
            <Text style={[styles.muted, styles.centered]}>
              Katıldığın mekanda kasada bu QR'ı okut: işletme damganı ekler ya da kart dolduysa ödülünü verir.
            </Text>
          </>
        )}
      </View>

      {error && <Text style={styles.endText}>{error}</Text>}
      {sorted.length === 0 && <Text style={styles.empty}>Henüz sadakat programı olan mekan yok.</Text>}
      {sorted.map((program) => {
        const member = program.member;
        return (
          <View key={program.venueId} style={styles.card}>
            <Text style={styles.venue}>{program.venueName}</Text>
            <Text style={styles.text}>⭐ {describeProgram(program)}</Text>
            {member && program.kind === 'stamps' && (
              <>
                <View style={styles.stamps}>
                  {Array.from({ length: program.stampsRequired }, (_, i) => (
                    <View key={i} style={[styles.stamp, i < member.stamps && styles.stampFull]}>
                      {i < member.stamps && <Text style={styles.stampMark}>☕</Text>}
                    </View>
                  ))}
                </View>
                {member.rewards > 0 && (
                  <Text style={styles.reward}>🎁 Kullanılabilir ödül: {member.rewards} · kasada QR'ını okut</Text>
                )}
              </>
            )}
            {member ? (
              <Pressable onPress={() => leave(program.venueId)} hitSlop={8}>
                <Text style={styles.endText}>{program.kind === 'stamps' ? 'Programdan çık' : 'Üyelikten çık'}</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.primary}
                onPress={async () => setError(await join(program.venueId))}
              >
                <Text style={styles.primaryText}>
                  {program.kind === 'stamps' ? 'Katıl' : `Üye ol (₺${program.price}/ay)`}
                </Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** Business: new campaign, scheduled campaigns and results of its own campaigns. */
function MyCampaigns({ business }: { business: BusinessInfo }) {
  const { campaigns, now, end, remove, create } = useCampaigns();
  const { venues } = useVenuesByIds([business.venueId]);
  const venue = venues[0];
  const mine = campaigns.filter((c) => c.venueId === business.venueId);
  const ended = mine.filter((c) => !isActive(c, now));
  const totals = campaignTotals(campaigns, business.venueId, 7, now);

  return (
    <View style={styles.list}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Son 7 gün kampanya sonuçları</Text>
        <Text style={styles.text}>
          📣 {totals.campaigns} kampanya · 👁 {totals.views} gösterim · 🎟 {totals.claims} kupon · ✅ {totals.redemptions} kullanım
        </Text>
      </View>
      {venue && (
        <>
          <CampaignForm venue={venue} plan={business.plan} />
          <ScheduleSection
            venue={venue}
            plan={business.plan}
            onUpgrade={() => business.onPlanChange('saas')}
          />
        </>
      )}
      <View style={styles.cardHeader}>
        <Text style={styles.sectionTitle}>Kampanyaların</Text>
        {ended.length > 1 && (
          <Pressable onPress={() => remove(ended.map((c) => c.id))} hitSlop={8}>
            <Text style={styles.endText}>Bitenlerin hepsini sil</Text>
          </Pressable>
        )}
      </View>
      {mine.length === 0 && <Text style={styles.muted}>Henüz kampanyan yok.</Text>}
      {mine.map((c) => {
        const live = isActive(c, now);
        const stats = c.stats ?? { views: 0, claims: 0, redemptions: 0 };
        return (
          <View key={c.id} style={styles.card}>
            <Text style={[styles.text, !live && styles.faded]}>{c.message}</Text>
            <Text style={[styles.muted, !live && styles.faded]}>
              {live ? `Aktif · ${timeLeft(c, now)}` : 'Bitti'} · {c.radiusKm} km{c.checkinOnly ? ' · 📍 check-in yapana' : ''} · 👁 {stats.views} gösterim ·
              🎟 {stats.claims} kupon · ✅ {stats.redemptions} kullanım
            </Text>
            {live ? (
              <Pressable onPress={() => end(c.id)} hitSlop={8}>
                <Text style={styles.endText}>Bitir</Text>
              </Pressable>
            ) : (
              <View style={styles.actions}>
                <Pressable onPress={() => create(repeatCampaign(c))} hitSlop={8}>
                  <Text style={styles.repeatText}>↻ Tekrar gönder</Text>
                </Pressable>
                <Pressable onPress={() => remove([c.id])} hitSlop={8}>
                  <Text style={styles.endText}>🗑 Sil</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** Business: what nearby venues are offering right now. */
function Rivals({ venueId }: { venueId: number }) {
  const { campaigns, now } = useCampaigns();
  const { venues } = useVenuesByIds([venueId]);
  const venue = venues[0];
  if (!venue) return null;
  const rivals = campaigns
    .filter((c) => c.venueId !== venueId && isActive(c, now))
    .map((c) => ({ campaign: c, km: distanceKm(venue, c) }))
    .filter(({ km }) => km <= RIVAL_RADIUS_KM)
    .sort((a, b) => a.km - b.km);

  return (
    <View style={styles.list}>
      <Text style={styles.muted}>{RIVAL_RADIUS_KM} km içindeki diğer mekanların şu anki kampanyaları</Text>
      {rivals.length === 0 && <Text style={styles.empty}>Şu an yakınında kampanya yapan başka mekan yok.</Text>}
      {rivals.map(({ campaign, km }) => (
        <View key={campaign.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.venue} numberOfLines={1}>
              {campaign.venueName}
            </Text>
            {campaign.discount !== null && <Text style={styles.badge}>%{campaign.discount}</Text>}
          </View>
          <Text style={styles.text}>{campaign.message}</Text>
          <Text style={styles.muted}>
            📍 {formatDistance(km)} · {timeLeft(campaign, now)} · {campaign.radiusKm} km'ye gönderildi
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Business: set up the loyalty program, switch it on/off and stamp members. */
function MyPrograms() {
  return (
    <View style={styles.list}>
      <LoyaltySetup />
    </View>
  );
}

/** Business: check a customer's coupon and see the coupons taken for its campaigns. */
function VenueCoupons({ venueId }: { venueId: number }) {
  const { coupons } = useCampaigns();
  const mine = coupons.filter((c) => c.venueId === venueId);
  return (
    <View style={styles.list}>
      <CouponVerifier />
      <Text style={styles.sectionTitle}>Alınan kuponlar</Text>
      {mine.length === 0 && <Text style={styles.muted}>Henüz kupon alınmadı.</Text>}
      {mine.map((c) => (
        <View key={c.code} style={[styles.card, c.redeemedAt !== null && styles.faded]}>
          <View style={styles.codeRow}>
            <Text style={styles.code}>{c.code}</Text>
            <Text style={styles.muted}>{c.redeemedAt ? 'Kullanıldı' : 'Bekliyor'}</Text>
          </View>
          <Text style={styles.muted} numberOfLines={1}>
            {c.message}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 40, gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { gap: 12 },
  muted: { fontSize: 13, color: colors.textMuted },
  text: { fontSize: 14, color: colors.text },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 20, lineHeight: 20 },
  card: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  faded: { opacity: 0.55 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  venue: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.primary,
    color: colors.onPrimary,
    fontWeight: '700',
  },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 16, fontWeight: '800', letterSpacing: 1.5, color: colors.text },
  qr: { alignItems: 'center', paddingVertical: 10 },
  centered: { textAlign: 'center' },
  pointsCard: { padding: 16, borderRadius: 16, backgroundColor: colors.cream, gap: 4 },
  pointsLabel: { fontSize: 14, color: colors.textMuted },
  points: { fontSize: 36, fontWeight: '800', color: colors.primary },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stamp: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampFull: { borderColor: colors.primary, backgroundColor: colors.cream },
  stampMark: { fontSize: 14 },
  reward: { fontSize: 13, color: colors.success, fontWeight: '600' },
  primary: { paddingVertical: 11, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontWeight: '700' },
  secondary: {
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  secondaryText: { color: colors.primary, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 4 },
  endText: { color: colors.danger, fontWeight: '600' },
  repeatText: { color: colors.primary, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 18 },
}));
