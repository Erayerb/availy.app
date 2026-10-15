import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CampaignBox } from '../components/CampaignBox';
import { CampaignForm } from '../components/business/CampaignForm';
import { CouponVerifier } from '../components/business/CouponVerifier';
import { LoyaltySetup } from '../components/business/LoyaltySetup';
import { ScheduleSection } from '../components/business/ScheduleSection';
import { Chip } from '../components/TagChips';
import { useCampaigns } from '../context/CampaignsContext';
import { useEngagement } from '../context/EngagementContext';
import { useLocation } from '../context/LocationContext';
import { isActive, timeLeft, visibleCampaigns, type Campaign } from '../lib/campaigns';
import { useVenuesByIds } from '../hooks/useVenuesByIds';
import { campaignStats, couponQrPayload } from '../lib/coupons';
import { formatDistance } from '../lib/geo';
import type { PlanId } from '../lib/plans';
import QRCode from 'react-native-qrcode-svg';

import {
  availyPoints,
  customerCode,
  customerQrPayload,
  describeProgram,
  isProgramActive,
} from '../lib/loyalty';
import { colors } from '../theme';

type Tab = 'campaigns' | 'coupons' | 'loyalty' | 'myCampaigns' | 'myPrograms' | 'venueCoupons';

// Campaigns, coupons and loyalty share one bottom tab
const CUSTOMER_TABS: { tab: Tab; label: string }[] = [
  { tab: 'campaigns', label: 'Kampanyalar' },
  { tab: 'coupons', label: 'Kuponlarım' },
  { tab: 'loyalty', label: 'Sadakat' },
];

// A business sees its own campaigns, coupons and loyalty program, plus what customers nearby see
const BUSINESS_TABS: { tab: Tab; label: string }[] = [
  { tab: 'myCampaigns', label: 'Kampanyalarım' },
  { tab: 'venueCoupons', label: 'Kuponlar' },
  { tab: 'myPrograms', label: 'Sadakat programım' },
  { tab: 'campaigns', label: 'Yakındaki' },
];

export type BusinessInfo = {
  venueId: number;
  plan: PlanId;
  verified: boolean;
  onPlanChange: (plan: PlanId) => void;
};

type Props = {
  signedIn: boolean;
  business: BusinessInfo | null; // set for business accounts
  onLogin: () => void;
  onOpenVenue: (campaign: Pick<Campaign, 'venueId' | 'lat' | 'lon'>) => void;
};

export function CampaignsScreen({ signedIn, business, onLogin, onOpenVenue }: Props) {
  const tabs = business ? BUSINESS_TABS : CUSTOMER_TABS;
  const [tab, setTab] = useState<Tab>(tabs[0].tab);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <Text style={styles.title}>Kampanyalar ve Sadakat</Text>
      </View>
      <View style={styles.tabs}>
        {tabs.map(({ tab: t, label }) => (
          <Chip key={t} label={label} active={tab === t} onPress={() => setTab(t)} />
        ))}
      </View>
      {tab === 'campaigns' && <CampaignList onOpenVenue={onOpenVenue} />}
      {tab === 'coupons' && <MyCoupons />}
      {tab === 'loyalty' && <Loyalty signedIn={signedIn} onLogin={onLogin} />}
      {tab === 'myCampaigns' && business && <MyCampaigns business={business} />}
      {tab === 'myPrograms' && business && <MyPrograms business={business} />}
      {tab === 'venueCoupons' && business && <VenueCoupons venueId={business.venueId} />}
    </ScrollView>
  );
}

function CampaignList({ onOpenVenue }: Pick<Props, 'onOpenVenue'>) {
  const { campaigns, now } = useCampaigns();
  const { recordView } = useEngagement();
  const location = useLocation();
  const nearby = visibleCampaigns(campaigns, location.point, now);

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
          Yakınında aktif kampanya yok.{'\n'}İşletme hesabıyla panelden kampanya oluşturup burada
          görebilirsin.
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
  const { coupons, userKey } = useEngagement();
  const { campaigns, now } = useCampaigns();
  const mine = coupons.filter((c) => c.userKey === userKey);

  return (
    <View style={styles.list}>
      {mine.length === 0 && (
        <Text style={styles.empty}>Henüz kuponun yok. Kampanyalardan "Kuponu al"a dokun.</Text>
      )}
      {mine.map((coupon) => {
        const campaign = campaigns.find((c) => c.id === coupon.campaignId);
        const status = coupon.redeemedAt
          ? 'Kullanıldı'
          : campaign && isActive(campaign, now)
            ? 'Geçerli · kasada göster'
            : 'Süresi doldu';
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

function Loyalty({ signedIn, onLogin }: { signedIn: boolean; onLogin: () => void }) {
  const { programs, cards, memberships, coupons, userKey, toggleMembership } = useEngagement();

  if (!signedIn) {
    return (
      <View style={styles.list}>
        <Text style={styles.empty}>Damga toplamak ve availy puanı kazanmak için giriş yap.</Text>
        <Pressable style={styles.primary} onPress={onLogin}>
          <Text style={styles.primaryText}>Giriş yap</Text>
        </Pressable>
      </View>
    );
  }

  const myCards = cards.filter((c) => c.userKey === userKey);
  // Paused programs are hidden from customers
  const visiblePrograms = programs.filter(isProgramActive);
  const stampsCollected = myCards.reduce(
    (sum, c) =>
      sum +
      c.stamps +
      c.rewardsAvailable * (programs.find((p) => p.venueId === c.venueId)?.stampsRequired ?? 0),
    0,
  );
  const couponsUsed = coupons.filter((c) => c.userKey === userKey && c.redeemedAt).length;

  return (
    <View style={styles.list}>
      <View style={styles.pointsCard}>
        <Text style={styles.pointsLabel}>availy puanın</Text>
        <Text style={styles.points}>{availyPoints(stampsCollected, couponsUsed)}</Text>
        <Text style={styles.muted}>Her damga 5, kullandığın her kupon 10 puan.</Text>
        <View style={styles.qr}>
          <QRCode
            value={customerQrPayload(customerCode(userKey))}
            size={170}
            backgroundColor={colors.cream}
            color={colors.text}
          />
        </View>
        <Text style={[styles.text, styles.centered]}>
          <Text style={styles.code}>{customerCode(userKey)}</Text>
        </Text>
        <Text style={[styles.muted, styles.centered]}>Kasada bu QR'ı okut: işletme damganı ekler ya da kart dolduysa ödülünü verir.</Text>
      </View>

      {visiblePrograms.length === 0 && (
        <Text style={styles.empty}>Henüz sadakat programı olan mekan yok.</Text>
      )}
      {visiblePrograms.map((program) => {
        const card = myCards.find((c) => c.venueId === program.venueId);
        const member = memberships.some((m) => m.venueId === program.venueId && m.userKey === userKey);
        return (
          <View key={program.venueId} style={styles.card}>
            <Text style={styles.venue}>{program.venueName}</Text>
            <Text style={styles.text}>⭐ {describeProgram(program)}</Text>
            {program.kind === 'stamps' ? (
              <>
                <View style={styles.stamps}>
                  {Array.from({ length: program.stampsRequired }, (_, i) => (
                    <View key={i} style={[styles.stamp, i < (card?.stamps ?? 0) && styles.stampFull]}>
                      {i < (card?.stamps ?? 0) && <Text style={styles.stampMark}>☕</Text>}
                    </View>
                  ))}
                </View>
                {(card?.rewardsAvailable ?? 0) > 0 && (
                  <Text style={styles.reward}>
                    🎁 Kullanılabilir ödül: {card!.rewardsAvailable} · kasada QR'ını okut
                  </Text>
                )}
              </>
            ) : (
              <Pressable
                style={member ? styles.secondary : styles.primary}
                onPress={() => toggleMembership(program.venueId)}
              >
                <Text style={member ? styles.secondaryText : styles.primaryText}>
                  {member ? 'Üyesin · üyeliği bitir' : `Üye ol (₺${program.price}/ay, demo)`}
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
  const { campaigns, now, end, remove } = useCampaigns();
  const { views, coupons } = useEngagement();
  const { venues } = useVenuesByIds([business.venueId]);
  const venue = venues[0];
  const mine = campaigns.filter((c) => c.venueId === business.venueId);
  const ended = mine.filter((c) => !isActive(c, now));

  return (
    <View style={styles.list}>
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
        const stats = campaignStats(c.id, views, coupons);
        return (
          <View key={c.id} style={[styles.card, !live && styles.faded]}>
            <Text style={styles.text}>{c.message}</Text>
            <Text style={styles.muted}>
              {live ? `Aktif · ${timeLeft(c, now)}` : 'Bitti'} · {c.radiusKm} km · 👁 {stats.views} gösterim ·
              🎟 {stats.claims} kupon · ✅ {stats.redemptions} kullanım
            </Text>
            {live ? (
              <Pressable onPress={() => end(c.id)} hitSlop={8}>
                <Text style={styles.endText}>Bitir</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => remove([c.id])} hitSlop={8}>
                <Text style={styles.endText}>🗑 Sil</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** Business: set up the loyalty program, switch it on/off and stamp customers. */
function MyPrograms({ business }: { business: BusinessInfo }) {
  const { cards, memberships, programs } = useEngagement();
  const { venues } = useVenuesByIds([business.venueId]);
  const venue = venues[0];
  const program = programs.find((p) => p.venueId === business.venueId);

  return (
    <View style={styles.list}>
      {venue && <LoyaltySetup venue={venue} />}
      {program && (
        <Text style={styles.muted}>
          {program.kind === 'stamps'
            ? `${cards.filter((c) => c.venueId === business.venueId).length} müşterinin damga kartı var`
            : `${memberships.filter((m) => m.venueId === business.venueId).length} üye`}
        </Text>
      )}
    </View>
  );
}

/** Business: check a customer's coupon and see the coupons taken for its campaigns. */
function VenueCoupons({ venueId }: { venueId: number }) {
  const { coupons } = useEngagement();
  const mine = coupons.filter((c) => c.venueId === venueId);
  return (
    <View style={styles.list}>
      <CouponVerifier venueId={venueId} />
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

const styles = StyleSheet.create({
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
});
