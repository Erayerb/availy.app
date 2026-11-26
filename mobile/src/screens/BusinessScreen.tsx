import type { ReactNode } from 'react';
import { SponsorCard } from '../components/business/SponsorCard';
import { GradientFill } from '../components/GradientFill';
import { StatusPill } from '../components/StatusPill';
import { VenuePhoto } from '../components/VenuePhoto';
import { TINT } from '../components/Settings';
import { useCallback, useEffect,  useState } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { useOnPageFocus, usePageTop } from '../context/PageContext';
import { PageSkeleton } from '../components/Skeleton';
import { usePullRefresh } from '../hooks/usePullRefresh';
import { Text } from '../components/Text';
import { Pressable } from '../components/Pressable';

import { HeaderButtons } from '../components/HeaderButtons';
import { CrowdDot } from '../components/CrowdDot';
import { useCampaigns } from '../context/CampaignsContext';
import { confirmAction } from '../lib/confirm';
import { ApiError } from '../lib/accountApi';
import { DEFAULT_PLAN } from '../lib/plans';
import { useSettings } from '../context/SettingsContext';
import { fetchVenues, fetchVenuesByIds, type Venue } from '../lib/api';
import type { User } from '../lib/auth';
import { busiestDaysText, busiestHour, businessApi, quietestWeekday, quietSlotLabel, quietSlotSchedule, WEEKDAY_NAMES, type VenueStats } from '../lib/business';
import { deadHour, deadHourSuggestion, QUIET_HOURS, timeLeft } from '../lib/campaigns';
import { crowdRatioText, crowdSummary, crowdYesterday } from '../lib/crowd';
import { categoryLabel } from '../lib/filters';
import { formatDistance } from '../lib/geo';
import { shortLocation } from '../lib/location';
import { bboxAround } from '../lib/nearby';
import { formatHour, nearbyCompetitors } from '../lib/stats';
import { colors, themed } from '../theme';
import { Icon, InlineIcon, type IconName } from '../components/Icon';
import { MonthReport } from '../components/business/MonthReport';
import { ProfileProgress } from '../components/business/ProfileProgress';
import { LockedPreview } from '../components/business/LockedPreview';

const REFRESH_MS = 30_000;
const CHART_HEIGHT = 80;
// Made-up numbers behind the free plan's blurred panels
const SAMPLE_HOURS = [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 6, 5, 3, 3, 4, 6, 8, 10, 7, 4, 2, 0];
const SAMPLE_WEEKDAYS = [12, 9, 14, 16, 22, 30, 25];
const SAMPLE_COMPETITORS = [
  ['Köşe Kahve', '350 m', 'Kalabalık'],
  ['Mavi Fırın', '700 m', 'Orta'],
  ['Bahçe Cafe', '1,2 km', 'Sakin'],
];

type Props = {
  venueId: number;
  user: User;
  onShowOnMap: (venue: Venue) => void;
  onEditProfile: () => void; // Daha fazla > İşletme profili
  onUpgrade: () => void; // Abonelik: scheduled campaigns are in the monthly plan
};

/** v2 business panel: everything from customers' check-ins (no estimated occupancy). */
export function BusinessScreen({ venueId, user, onShowOnMap, onEditProfile, onUpgrade }: Props) {
  const [venue, setVenue] = useState<Venue | null>(null);
  const [nearby, setNearby] = useState<Venue[]>([]);
  const [stats, setStats] = useState<VenueStats | null>(null);
  const [statsLocked, setStatsLocked] = useState(false); // not in the plan (402)
  const [today, setToday] = useState<{ checkins: number; new_people: number } | null>(null); // the free plan's two numbers
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ ok: boolean; text: string } | null>(null);
  const { now, create, activeFor, schedules, addSchedule, access } = useCampaigns();
  // The server's plan wins (a running 15-day trial counts as the Aylık paket)
  const plan = access?.plan ?? user.plan ?? DEFAULT_PLAN;
  const [slotNote, setSlotNote] = useState<{ ok: boolean; text: string } | null>(null);
  const { crowdLook } = useSettings();

  const load = useCallback(async () => {
    try {
      const [mine] = await fetchVenuesByIds([venueId]);
      if (!mine) return setError('Mekan bulunamadı.');
      setVenue(mine);
      setError(null);
      fetchVenues(bboxAround(mine, 0.02), []).then(setNearby).catch(() => {});
      if (user.token)
        businessApi
          .stats(user.token, venueId)
          .then((s) => {
            setStats(s);
            setStatsLocked(false);
          })
          .catch((e) => {
            setStats(null);
            const locked = e instanceof ApiError && e.status === 402;
            setStatsLocked(locked);
            if (locked && user.token) businessApi.today(user.token).then(setToday).catch(() => {});
          });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi.');
    }
  }, [venueId, user.token, user.plan]);
  const pull = usePullRefresh(load);
  useOnPageFocus(load);
  const top = usePageTop();

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (!venue && !error) return <PageSkeleton />;
  if (!venue) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{error}</Text>
      </View>
    );
  }

  const active = activeFor(venue.id);
  const look = crowdLook(venue);
  const dead = deadHour(venue, now);
  const competitors = nearbyCompetitors(venue, nearby, 2, 5);
  const busiest = stats ? busiestHour(stats.today) : null;
  const quietSlot = stats?.quiet_slot ?? null;
  const slotScheduled = quietSlot !== null && schedules.some((s) => s.active && s.days.includes(quietSlot.weekday) && s.start_hour === quietSlot.start_hour);
  const quietDay = stats && stats.weekday.some((n) => n > 0) ? quietestWeekday(stats.weekday) : null;
  const maxToday = stats ? Math.max(1, ...stats.today.map((h) => h.checkins)) : 1;
  const maxWeekday = stats ? Math.max(1, ...stats.weekday) : 1;
  const hourNow = (now.getUTCHours() + 3) % 24; // Istanbul

  const sendReady = async () => {
    const failure = await create({
      venueId: venue.id,
      venueName: venue.name,
      lat: venue.lat,
      lon: venue.lon,
      message: deadHourSuggestion(venue.category),
      discount: 20,
      durationHours: 2,
      radiusKm: 2,
    });
    setSent(failure ? { ok: false, text: failure } : { ok: true, text: '✓ Kampanya 2 km içindeki kullanıcılara gönderildi.' });
  };

  return (
    <ScrollView ref={top} style={styles.page} contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl {...pull} tintColor={colors.primary} />}>
      <View style={styles.topRow}>
        <Text style={styles.pageTitle}>İşletme paneli</Text>
        <HeaderButtons />
      </View>

      {/* Until the venue page is complete: the cover photo first, then what else is missing */}
      {user.token && <MonthReport token={user.token} />}

      {/* "Şimdi yap": the venue looks quiet and no campaign runs. The Aylık paket sends the ready one with one tap;
          the free plan is shown the way to it */}
      {(dead === 'confirmed' || dead === 'noCheckins') && !active && (
        <View style={[styles.card, styles.nowCard]}>
          <PanelTitle icon="bolt" tint={TINT.red}>Şimdi yap</PanelTitle>
          <Text style={styles.alertTitle}>
            {dead === 'confirmed' ? 'Müşteriler mekanını Sakin bildiriyor' : `Son ${QUIET_HOURS} saattir check-in yok; mekanın sakin olabilir`}
          </Text>
          <Text style={styles.text}>Boş masaları doldurmak için yakındakilere hazır kampanyayı gönder.</Text>
          <Text style={styles.quote}>“{deadHourSuggestion(venue.category)}”</Text>
          {plan === 'saas' ? (
            <Pressable style={styles.primary} onPress={sendReady}>
              <Text style={styles.primaryText}>Hazır kampanyayı gönder (2 saat · 2 km)</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.primary} onPress={onUpgrade}>
              <Text style={styles.primaryText}><InlineIcon name="lock" /> Aylık pakette tek dokunuşla gönder</Text>
            </Pressable>
          )}
        </View>
      )}
      {sent && <Text style={sent.ok ? styles.success : styles.error}>{sent.text}</Text>}
      {user.token && <ProfileProgress venue={venue} token={user.token} onSaved={load} onEditProfile={onEditProfile} />}

      {/* The venue as customers see it: cover, name and the crowd now */}
      <Pressable onPress={() => onShowOnMap(venue)} style={styles.hero}>
        <VenuePhoto venueId={venue.id} category={venue.category} photoAt={venue.photo_at} size="100%" height={170} radius={20} />
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GradientFill colors={['#000', '#000']} scrim />
        </View>
        <View style={styles.heroText} pointerEvents="none">
          <StatusPill venue={venue} onPhoto />
          <Text style={styles.heroName} numberOfLines={2}>{venue.name}</Text>
          <Text style={styles.heroMeta} numberOfLines={1}>
            {categoryLabel(venue.category)} · {shortLocation(venue.neighborhood, venue.district)} · Haritada gör ›
          </Text>
        </View>
        <Pressable style={styles.heroEdit} onPress={onEditProfile} hitSlop={6} accessibilityLabel="Mekanı düzenle">
          <Icon name="pencil" size={15} color="#fff" />
          <Text style={styles.heroEditText}>Düzenle</Text>
        </Pressable>
      </Pressable>

      {/* Now: what customers see */}
      <View style={styles.card}>
        <PanelTitle icon="circle-dot" tint={TINT.red}>Şu an</PanelTitle>
        <View style={styles.levelRow}>
          <CrowdDot venue={venue} size={16} />
          <Text style={styles.nowLabel}>{look.label}</Text>
          {crowdRatioText(venue.crowd) && <Text style={styles.nowRatio}>{crowdRatioText(venue.crowd)}</Text>}
        </View>
        <Text style={styles.text}>{venue.open_now ? crowdSummary(venue.crowd, new Date()) : `${venue.opens_at}'de açılır`}</Text>
        {venue.open_now && crowdYesterday(venue.crowd) && <Text style={styles.text}><InlineIcon name="history" /> {crowdYesterday(venue.crowd)}</Text>}
        <Text style={styles.muted}><InlineIcon name="clock" /> {venue.hours} · Müşterilerin gördüğü durum, onların check-in'lerinden.</Text>

        {dead === 'oneReport' && !active && <Text style={styles.text}>1 müşteri Sakin bildirdi.</Text>}
        {active && <Text style={styles.activeNote}><InlineIcon name="tag" /> Aktif kampanyan var · {timeLeft(active, now)}</Text>}
      </View>

      {/* Today */}
      {user.token && <SponsorCard token={user.token} />}

      {statsLocked ? (
        <>
          {/* Free plan: today in two numbers; the rest is in the Aylık paket */}
          <View style={styles.card}>
            <PanelTitle icon="clock" tint={TINT.orange}>Bugün</PanelTitle>
            <View style={styles.stats}>
              <Stat value={today?.checkins ?? 0} label="Check-in" />
              <Stat value={today?.new_people ?? 0} label="Yeni müşteri" />
            </View>
          </View>
          {/* The rest is in the Aylık paket: the panels stay, blurred over sample numbers (never the real ones) */}
          <LockedPreview title={<PanelTitle icon="clock" tint={TINT.orange}>Bugün saat saat</PanelTitle>} onUpgrade={onUpgrade}>
            <View style={styles.chart}>
              {SAMPLE_HOURS.map((n, i) => (
                <View key={i} style={styles.slot}>
                  <View style={[styles.bar, { height: Math.max(2, n * 8), backgroundColor: n ? colors.primary : colors.border }]} />
                </View>
              ))}
            </View>
            <Text style={styles.text}>En çok check-in 19:00 civarında.</Text>
          </LockedPreview>
          <LockedPreview title={<PanelTitle icon="chart-line" tint={TINT.blue}>Son 7 gün</PanelTitle>} onUpgrade={onUpgrade}>
            <View style={styles.stats}>
              <Stat value={48} label="Check-in" />
              <Stat value={31} label="Kişi" />
              <Stat value={12} label="Tekrar gelen" />
            </View>
          </LockedPreview>
          <LockedPreview title={<PanelTitle icon="chart-bar" tint={TINT.purple}>Haftanın günleri (son 30 gün)</PanelTitle>} onUpgrade={onUpgrade}>
            <View style={styles.weekChart}>
              {SAMPLE_WEEKDAYS.map((n, i) => (
                <View key={WEEKDAY_NAMES[i]} style={styles.weekSlot}>
                  <Text style={styles.axisText}>{n}</Text>
                  <View style={[styles.weekBar, { height: Math.max(3, (n / 30) * CHART_HEIGHT) }]} />
                  <Text style={styles.axisText}>{WEEKDAY_NAMES[i]}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.text}>En sakin saatlerin ve onlara haftalık kampanya.</Text>
          </LockedPreview>
        </>
      ) : (
        <>
      <View style={styles.card}>
        <PanelTitle icon="clock" tint={TINT.orange}>Bugün · {stats?.today_checkins ?? 0} check-in</PanelTitle>
        {!stats || stats.today_checkins === 0 ? (
          <Text style={styles.muted}>Bugün check-in yok. Müşterilerin geldikçe saat saat burada görürsün.</Text>
        ) : (
          <>
            <View style={styles.chart}>
              {stats.today.map((h) => (
                <View key={h.hour} style={styles.slot}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: h.checkins ? Math.max(6, (h.checkins / maxToday) * CHART_HEIGHT) : 2,
                        backgroundColor: h.level ? crowdLook({ open_now: true, crowd: { state: 'live', level: h.level, ratio: null, reporters: 2, last_report_at: null, queue: null, seats: null } }).color : colors.border,
                      },
                      h.hour === hourNow && styles.barNow,
                    ]}
                  />
                </View>
              ))}
            </View>
            <View style={styles.axis}>
              {['00', '06', '12', '18', '23'].map((t) => (
                <Text key={t} style={styles.axisText}>
                  {t}
                </Text>
              ))}
            </View>
            {busiest !== null && (
              <Text style={styles.text}>En çok check-in {formatHour(busiest)} civarında. Çubuğun rengi o saatteki doluluk.</Text>
            )}
          </>
        )}
      </View>

      {/* Last 7 days */}
      <View style={styles.card}>
        <PanelTitle icon="chart-line" tint={TINT.blue}>Son 7 gün</PanelTitle>
        <View style={styles.stats}>
          <Stat value={stats?.week_checkins ?? 0} label="Check-in" />
          <Stat value={stats?.week_people ?? 0} label="Kişi" />
          <Stat value={stats?.week_returning ?? 0} label="Tekrar gelen" />
        </View>
      </View>

      {/* Weekdays */}
      <View style={styles.card}>
        <PanelTitle icon="chart-bar" tint={TINT.purple}>Haftanın günleri (son 30 gün)</PanelTitle>
        {!stats || stats.weekday.every((n) => n === 0) ? (
          <Text style={styles.muted}>Biraz daha check-in gelince burada görürsün.</Text>
        ) : (
          <>
            <View style={styles.weekChart}>
              {stats.weekday.map((n, i) => (
                <View key={WEEKDAY_NAMES[i]} style={styles.weekSlot}>
                  <Text style={styles.axisText}>{n}</Text>
                  <View style={[styles.weekBar, { height: Math.max(3, (n / maxWeekday) * CHART_HEIGHT) }]} />
                  <Text style={styles.axisText}>{WEEKDAY_NAMES[i]}</Text>
                </View>
              ))}
            </View>
            {busiestDaysText(stats.weekday) && <Text style={styles.busiest}>{busiestDaysText(stats.weekday)}</Text>}
            {quietSlot ? (
              <View style={styles.alert}>
                <Text style={styles.alertTitle}>En sakin saatlerin: {quietSlotLabel(quietSlot)}</Text>
                <Text style={styles.text}>Son 30 günün check-in'lerine göre. Her hafta bu saatte kendiliğinden kampanya başlatabilirsin.</Text>
                {plan !== 'saas' ? (
                  <Pressable style={styles.primary} onPress={onUpgrade}>
                    <Text style={styles.primaryText}>Aylık paket'e geç</Text>
                  </Pressable>
                ) : slotScheduled ? (
                  <Text style={styles.success}>✓ Bu saate zamanlanmış kampanyan var.</Text>
                ) : (
                  <Pressable
                    style={styles.primary}
                    onPress={() =>
                      confirmAction(`Her hafta ${quietSlotLabel(quietSlot)} kampanya başlasın mı?`, '%20 indirim, 2 km içindekilere. Kampanyalar\'dan değiştirebilir ya da kapatabilirsin.', 'Başlat', async () => {
                        const failure = await addSchedule(quietSlotSchedule(quietSlot, venue.category));
                        setSlotNote(failure ? { ok: false, text: failure } : { ok: true, text: '✓ Zamanlandı; Kampanyalar\'da görürsün.' });
                      })
                    }
                  >
                    <Text style={styles.primaryText}>Haftalık kampanya kur</Text>
                  </Pressable>
                )}
                {slotNote && <Text style={slotNote.ok ? styles.success : styles.error}>{slotNote.text}</Text>}
              </View>
            ) : (
              quietDay !== null && (
                <Text style={styles.text}>
                  En az check-in {WEEKDAY_NAMES[quietDay]} günü. Bu güne zamanlanmış bir kampanya iyi bir fikir olabilir.
                </Text>
              )
            )}
          </>
        )}
      </View>
        </>
      )}

      {/* Nearby similar venues, as customers see them now (Aylık paket) */}
      {plan !== 'saas' ? (
        <LockedPreview title={<PanelTitle icon="map-search" tint={TINT.green}>Yakındaki benzer mekanlar (2 km)</PanelTitle>} onUpgrade={onUpgrade}>
          {SAMPLE_COMPETITORS.map(([name, distance, label]) => (
            <View key={name} style={styles.compRow}>
              <View style={styles.sampleDot} />
              <Text style={[styles.text, styles.flex]} numberOfLines={1}>{name}</Text>
              <Text style={styles.muted}>{distance}</Text>
              <Text style={styles.compLabel} numberOfLines={1}>{label}</Text>
            </View>
          ))}
        </LockedPreview>
      ) : (
        <View style={styles.card}>
          <PanelTitle icon="map-search" tint={TINT.green}>Yakındaki benzer mekanlar (2 km)</PanelTitle>
          {competitors.length === 0 && <Text style={styles.muted}>Çevrende benzer mekan yok.</Text>}
          {competitors.map(({ venue: other, distanceKm }) => (
            <View key={other.id} style={styles.compRow}>
              <CrowdDot venue={other} />
              <Text style={[styles.text, styles.flex]} numberOfLines={1}>
                {other.name}
              </Text>
              <Text style={styles.muted}>{formatDistance(distanceKm)}</Text>
              <Text style={styles.compLabel} numberOfLines={1}>
                {crowdLook(other).label}
              </Text>
            </View>
          ))}
        </View>
      )}

    </ScrollView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  hero: { borderRadius: 20, overflow: 'hidden' },
  heroText: { position: 'absolute', left: 14, right: 14, bottom: 14, gap: 5 },
  heroName: { fontSize: 23, fontWeight: '800', color: '#fff' },
  heroMeta: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  heroEdit: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.45)' },
  heroEditText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  panelTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  panelIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: TAB_BAR_SPACE, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, zIndex: 20, elevation: 20 },
  pageTitle: { fontSize: 24, fontWeight: '700', color: colors.text },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  error: { fontSize: 13, color: colors.danger },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  flex: { flex: 1 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nowLabel: { fontSize: 22, fontWeight: '800', color: colors.text },
  nowRatio: { fontSize: 18, fontWeight: '700', color: colors.textMuted },
  alert: { padding: 12, borderRadius: 12, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.primary, gap: 8 },
  alertTitle: { fontSize: 15, fontWeight: '700', color: colors.primary },
  quote: { fontSize: 14, fontStyle: 'italic', color: colors.text },
  activeNote: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  success: { fontSize: 14, color: colors.success, fontWeight: '600' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: 2 },
  slot: { flex: 1, justifyContent: 'flex-end' },
  bar: { borderRadius: 2 },
  barNow: { borderWidth: 1.5, borderColor: colors.text },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  axisText: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  weekChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  weekSlot: { flex: 1, alignItems: 'center', gap: 4 },
  weekBar: { width: '100%', borderRadius: 4, backgroundColor: colors.primary },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, padding: 10, borderRadius: 14, backgroundColor: colors.cream, alignItems: 'center' },
  nowCard: { borderColor: colors.primary, borderWidth: 1.5 },
  busiest: { fontSize: 15, fontWeight: '700', color: colors.text },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text }, // neutral: a 0 is no alarm
  statLabel: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  compRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sampleDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  compLabel: { fontSize: 13, fontWeight: '600', color: colors.text, maxWidth: 110, textAlign: 'right' },
  primary: { paddingVertical: 13, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontSize: 15, fontWeight: '600', textAlign: 'center' },
}));

/** A panel card's title with a coloured icon square, like the settings rows. */
function PanelTitle({ icon, tint, children }: { icon: IconName; tint: string; children: ReactNode }) {
  return (
    <View style={styles.panelTitle}>
      <View style={[styles.panelIcon, { backgroundColor: tint }]}>
        <Icon name={icon} size={15} color="#fff" />
      </View>
      <Text style={styles.sectionTitle}>{children}</Text>
    </View>
  );
}
