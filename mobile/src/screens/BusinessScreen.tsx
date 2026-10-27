import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from '../components/Pressable';

import { HeaderButtons } from '../components/HeaderButtons';
import { CrowdDot } from '../components/CrowdDot';
import { useCampaigns } from '../context/CampaignsContext';
import { useSettings } from '../context/SettingsContext';
import { fetchVenues, fetchVenuesByIds, type Venue } from '../lib/api';
import type { User } from '../lib/auth';
import { busiestHour, businessApi, MAX_REWARD, quietestWeekday, WEEKDAY_NAMES, type VenueStats } from '../lib/business';
import { deadHourSuggestion, timeLeft } from '../lib/campaigns';
import { crowdRatioText, crowdSummary, crowdYesterday, liveLevel } from '../lib/crowd';
import { categoryLabel } from '../lib/filters';
import { formatDistance } from '../lib/geo';
import { shortLocation } from '../lib/location';
import { bboxAround } from '../lib/nearby';
import { formatHour, nearbyCompetitors } from '../lib/stats';
import { colors, themed } from '../theme';

const REFRESH_MS = 30_000;
const CHART_HEIGHT = 80;

type Props = {
  venueId: number;
  user: User;
  onShowOnMap: (venue: Venue) => void;
  onOpenUser: (username: string) => void;
  onRegister: () => void;
};

/** v2 business panel: everything from customers' check-ins (no estimated occupancy). */
export function BusinessScreen({ venueId, user, onShowOnMap, onOpenUser, onRegister }: Props) {
  const [venue, setVenue] = useState<Venue | null>(null);
  const [nearby, setNearby] = useState<Venue[]>([]);
  const [stats, setStats] = useState<VenueStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ ok: boolean; text: string } | null>(null);
  const { now, create, activeFor } = useCampaigns();
  const { crowdLook } = useSettings();

  const load = useCallback(async () => {
    try {
      const [mine] = await fetchVenuesByIds([venueId]);
      if (!mine) return setError('Mekan bulunamadı.');
      setVenue(mine);
      setError(null);
      fetchVenues(bboxAround(mine, 0.02), []).then(setNearby).catch(() => {});
      if (user.token) businessApi.stats(user.token, venueId).then(setStats).catch(() => setStats(null));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi.');
    }
  }, [venueId, user.token]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (!venue) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{error ?? 'Yükleniyor…'}</Text>
      </View>
    );
  }

  const active = activeFor(venue.id);
  const look = crowdLook(venue);
  // Dead hour: open, and customers' fresh check-ins say Sakin
  const dead = liveLevel(venue) === 'low';
  const competitors = nearbyCompetitors(venue, nearby, 2, 5);
  const busiest = stats ? busiestHour(stats.today) : null;
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
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <Text style={styles.pageTitle}>İşletme Paneli</Text>
        <HeaderButtons />
      </View>

      <View style={styles.card}>
        <Pressable onPress={() => onShowOnMap(venue)}>
          <Text style={styles.venueName}>{venue.name}</Text>
          <Text style={styles.muted}>
            {categoryLabel(venue.category)} · {shortLocation(venue.neighborhood, venue.district)} · Haritada gör ›
          </Text>
        </Pressable>
        {stats?.discovered_by && user.token && (
          <Discoverer
            discoverer={stats.discovered_by}
            token={user.token}
            venueId={venue.id}
            onOpenUser={onOpenUser}
            onSent={load}
          />
        )}
      </View>

      {/* Now: what customers see */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Şu an</Text>
        <View style={styles.levelRow}>
          <CrowdDot venue={venue} size={16} />
          <Text style={styles.nowLabel}>{look.label}</Text>
          {crowdRatioText(venue.crowd) && <Text style={styles.nowRatio}>{crowdRatioText(venue.crowd)}</Text>}
        </View>
        <Text style={styles.text}>{venue.open_now ? crowdSummary(venue.crowd, new Date()) : `${venue.opens_at}'de açılır`}</Text>
        {venue.open_now && crowdYesterday(venue.crowd) && <Text style={styles.text}>🕘 {crowdYesterday(venue.crowd)}</Text>}
        <Text style={styles.muted}>🕒 {venue.hours} · Müşterilerin gördüğü durum, onların check-in'lerinden.</Text>

        {dead && !active && (
          <View style={styles.alert}>
            <Text style={styles.alertTitle}>Ölü saat: müşteriler mekanını Sakin bildiriyor</Text>
            <Text style={styles.text}>Boş masaları doldurmak için yakındaki kullanıcılara tek dokunuşla kampanya gönder.</Text>
            <Text style={styles.quote}>“{deadHourSuggestion(venue.category)}”</Text>
            <Pressable style={styles.primary} onPress={sendReady}>
              <Text style={styles.primaryText}>Hazır kampanyayı gönder (2 saat · 2 km)</Text>
            </Pressable>
          </View>
        )}
        {active && <Text style={styles.activeNote}>🏷️ Aktif kampanyan var · {timeLeft(active, now)}</Text>}
        {sent && <Text style={sent.ok ? styles.success : styles.error}>{sent.text}</Text>}
      </View>

      {/* Today */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Bugün · {stats?.today_checkins ?? 0} check-in</Text>
        {!stats || stats.today_checkins === 0 ? (
          <Text style={styles.muted}>Bugün henüz check-in yok. Müşterilerin check-in yaptıkça saat saat burada görünür.</Text>
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
        <Text style={styles.sectionTitle}>Son 7 gün</Text>
        <View style={styles.stats}>
          <Stat value={stats?.week_checkins ?? 0} label="check-in" />
          <Stat value={stats?.week_people ?? 0} label="kişi" />
          <Stat value={stats?.week_returning ?? 0} label="tekrar gelen" />
        </View>
        <Text style={styles.muted}>Toplam {stats?.total_checkins ?? 0} check-in.</Text>
      </View>

      {/* Weekdays */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Haftanın günleri (son 30 gün)</Text>
        {!stats || stats.weekday.every((n) => n === 0) ? (
          <Text style={styles.muted}>Henüz yeterli check-in yok.</Text>
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
            {quietDay !== null && (
              <Text style={styles.text}>
                En az check-in {WEEKDAY_NAMES[quietDay]} günü. Bu güne zamanlanmış bir kampanya iyi bir fikir olabilir.
              </Text>
            )}
          </>
        )}
      </View>

      {/* Nearby similar venues, as customers see them now */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Yakındaki benzer mekanlar (2 km)</Text>
        {competitors.length === 0 && <Text style={styles.muted}>Yakında benzer mekan yok.</Text>}
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

    </ScrollView>
  );
}

const REWARD_SUGGESTION = 'Mekanımızı keşfettiğin için teşekkürler! Bir sonraki siparişin bizden.';

/** "✨ Mekanını @x keşfetti" ("anonim bir kullanıcı" after a gizli check-in) and "Ödül ver": a thank-you sent once, as a notification. */
function Discoverer({
  discoverer,
  token,
  venueId,
  onOpenUser,
  onSent,
}: {
  discoverer: NonNullable<VenueStats['discovered_by']>;
  token: string;
  venueId: number;
  onOpenUser: (username: string) => void;
  onSent: () => void;
}) {
  const [writing, setWriting] = useState(false);
  const [message, setMessage] = useState(REWARD_SUGGESTION);
  const [error, setError] = useState<string | null>(null);
  const name = discoverer.username;

  const send = async () => {
    try {
      await businessApi.rewardDiscoverer(token, venueId, message);
      setWriting(false);
      setError(null);
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gönderilemedi.');
    }
  };

  return (
    <View style={styles.discoverer}>
      <View style={styles.levelRow}>
        <Text style={[styles.discovery, styles.flex]}>
          ✨ Mekanını{' '}
          {name ? (
            <Text style={styles.discoveryName} onPress={() => onOpenUser(name)}>
              @{name}
            </Text>
          ) : (
            'anonim bir kullanıcı'
          )}{' '}
          keşfetti
        </Text>
        {discoverer.can_reward && !discoverer.reward && !writing && (
          <Pressable style={styles.rewardButton} onPress={() => setWriting(true)}>
            <Text style={styles.rewardButtonText}>🎁 Ödül ver</Text>
          </Pressable>
        )}
      </View>
      {discoverer.reward && <Text style={styles.muted}>🎁 Ödül gönderildi: “{discoverer.reward}”</Text>}
      {writing && (
        <>
          <Text style={styles.muted}>Keşfedene bildirim olarak gider; kasada gösterir. Bir kez gönderilebilir.</Text>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            maxLength={MAX_REWARD}
            multiline
            placeholder="Ör. Bir sonraki kahven bizden"
            placeholderTextColor={colors.placeholder}
          />
          <View style={styles.levelRow}>
            <Pressable style={[styles.primary, styles.flex]} onPress={send}>
              <Text style={styles.primaryText}>Gönder</Text>
            </Pressable>
            <Pressable onPress={() => setWriting(false)} hitSlop={8}>
              <Text style={styles.muted}>Vazgeç</Text>
            </Pressable>
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
        </>
      )}
    </View>
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
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 48, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  pageTitle: { fontSize: 24, fontWeight: '700', color: colors.text },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  venueName: { fontSize: 18, fontWeight: '700', color: colors.text },
  discovery: { fontSize: 13, fontWeight: '600', color: colors.discovery },
  discoveryName: { fontWeight: '800', textDecorationLine: 'underline' },
  discoverer: { gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  rewardButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5, borderColor: colors.primary },
  rewardButtonText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  input: {
    minHeight: 60,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.cream,
    color: colors.text,
    fontSize: 14,
    textAlignVertical: 'top',
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
  statValue: { fontSize: 20, fontWeight: '800', color: colors.primary },
  statLabel: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  compRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compLabel: { fontSize: 13, fontWeight: '600', color: colors.text, maxWidth: 110, textAlign: 'right' },
  primary: { paddingVertical: 13, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontSize: 15, fontWeight: '600', textAlign: 'center' },
}));
