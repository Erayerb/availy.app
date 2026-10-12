import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HourlyChart } from '../components/HourlyChart';
import { MenuButton } from '../components/MenuButton';

import { useCampaigns } from '../context/CampaignsContext';
import { useBusinessData } from '../hooks/useBusinessData';
import type { Venue } from '../lib/api';
import { deadHourSuggestion, timeLeft } from '../lib/campaigns';
import { categoryLabel } from '../lib/filters';
import { formatDistance } from '../lib/geo';
import { shortLocation } from '../lib/location';
import { FeedbackSection } from '../components/business/FeedbackSection';

import { StatsSection } from '../components/business/StatsSection';


import { LevelDot } from '../components/LevelDot';
import { useSettings } from '../context/SettingsContext';

import { PLANS, type PlanId } from '../lib/plans';
import { formatHour, isDeadHour, nearbyCompetitors, percent, summarizeDay } from '../lib/stats';
import { colors } from '../theme';

// Istanbul is UTC+3 all year
const istanbulHour = (now: Date) => (now.getUTCHours() + 3) % 24;

type Props = {
  venueId: number;
  plan: PlanId;
  verified: boolean;
  onVerified: () => void;
  onMenu: () => void;
  onPlanChange: (plan: PlanId) => void;
  onShowOnMap: (venue: Venue) => void;
};

export function BusinessScreen({
  venueId,
  plan,
  verified,
  onVerified,
  onMenu,
  onPlanChange,
  onShowOnMap,
}: Props) {
  const { venue, hourly, all, error } = useBusinessData(venueId);
  const { now, create, activeFor } = useCampaigns();

  const [sent, setSent] = useState<string | null>(null);
  const { look } = useSettings();

  if (!venue) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{error ?? 'Yükleniyor…'}</Text>
      </View>
    );
  }

  const active = activeFor(venue.id);
  const { label } = look(venue.occupancy.level, venue.open_now);
  // Dead-hour prompt only while the venue is open
  const dead = venue.open_now && isDeadHour(venue.occupancy.ratio);
  const day = hourly.length ? summarizeDay(hourly) : null;
  const competitors = nearbyCompetitors(venue, all);

  const send = (input: {
    message: string;
    discount: number | null;
    durationHours: number;
    radiusKm: number;
  }) => {
    create({ venueId: venue.id, venueName: venue.name, lat: venue.lat, lon: venue.lon, ...input });
    setSent(`Kampanya ${input.radiusKm} km içindeki kullanıcılara gönderildi.`);
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <MenuButton onPress={onMenu} />
        <Text style={styles.pageTitle}>İşletme Paneli</Text>
      </View>

      <Pressable style={styles.card} onPress={() => onShowOnMap(venue)}>
        <Text style={styles.venueName}>{venue.name}</Text>
        <Text style={styles.muted}>
          {categoryLabel(venue.category)} · {shortLocation(venue.neighborhood, venue.district)} · Haritada gör
          ›
        </Text>
      </Pressable>

      {/* Now */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Şu an</Text>
        <View style={styles.nowRow}>
          <Text style={styles.bigPercent}>{venue.open_now ? percent(venue.occupancy.ratio) : 'Kapalı'}</Text>
          <View style={styles.nowInfo}>
            <View style={styles.levelRow}>
              <LevelDot level={venue.occupancy.level} open={venue.open_now} />
              <Text style={styles.text}>{label}</Text>
            </View>
            <Text style={styles.muted}>🕒 {venue.hours}</Text>
          </View>
        </View>

        {dead && !active && (
          <View style={styles.alert}>
            <Text style={styles.alertTitle}>Ölü saat: mekanın {percent(venue.occupancy.ratio)} dolu</Text>
            <Text style={styles.text}>
              Boş masaları doldurmak için yakındaki kullanıcılara tek tıkla kampanya gönder.
            </Text>
            <Text style={styles.quote}>“{deadHourSuggestion(venue.category)}”</Text>
            <Pressable
              style={styles.primary}
              onPress={() =>
                send({
                  message: deadHourSuggestion(venue.category),
                  discount: 20,
                  durationHours: 2,
                  radiusKm: 2,
                })
              }
            >
              <Text style={styles.primaryText}>Hazır kampanyayı gönder (2 saat · 2 km)</Text>
            </Pressable>
          </View>
        )}
        {active && <Text style={styles.activeNote}>🏷️ Aktif kampanyan var · {timeLeft(active, now)}</Text>}
        {sent && <Text style={styles.success}>✓ {sent}</Text>}
      </View>

      {/* Today */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Bugünkü doluluk</Text>
        {hourly.length > 0 && <HourlyChart hours={hourly} currentHour={istanbulHour(now)} />}
        {day && day.busiest.ratio > day.quietest.ratio && (
          <Text style={styles.text}>
            En sakin saat {formatHour(day.quietest.hour)} ({percent(day.quietest.ratio)}), en yoğun saat{' '}
            {formatHour(day.busiest.hour)} ({percent(day.busiest.ratio)}).
          </Text>
        )}
        {day && day.busiest.ratio === day.quietest.ratio && (
          <Text style={styles.text}>Bugün gün boyu {percent(day.busiest.ratio)} dolu görünüyor.</Text>
        )}
      </View>

      {/* Comparison */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Kıyaslama</Text>
        <CompareBar label="Sen" ratio={venue.occupancy.ratio} />
        <CompareBar label={`${venue.district} ortalaması`} ratio={venue.district_occupancy.ratio} />
        <Text style={[styles.label, styles.spaced]}>Yakındaki benzer mekanlar (2 km)</Text>
        {competitors.length === 0 && <Text style={styles.muted}>Yakında benzer mekan yok.</Text>}
        {competitors.map(({ venue: other, distanceKm }) => (
          <View key={other.id} style={styles.compRow}>
            <LevelDot level={other.occupancy.level} open={other.open_now} />
            <Text style={[styles.text, styles.flex]} numberOfLines={1}>
              {other.name}
            </Text>
            <Text style={styles.muted}>{formatDistance(distanceKm)}</Text>
            <Text style={styles.compPercent}>
              {other.open_now ? percent(other.occupancy.ratio) : 'Kapalı'}
            </Text>
          </View>
        ))}
      </View>

      <StatsSection venue={venue} />

      <FeedbackSection venueId={venue.id} />

      {/* Plan */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Paketin</Text>
        {(Object.keys(PLANS) as PlanId[]).map((id) => {
          const p = PLANS[id];
          const selected = id === plan;
          return (
            <Pressable
              key={id}
              style={[styles.plan, selected && styles.planSelected]}
              onPress={() => onPlanChange(id)}
            >
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{p.name}</Text>
                <Text style={styles.planPrice}>{p.price}</Text>
              </View>
              {p.features.map((f) => (
                <Text key={f} style={styles.muted}>
                  • {f}
                </Text>
              ))}
              <Text style={selected ? styles.planActive : styles.planChoose}>
                {selected ? '✓ Mevcut paketin' : 'Bu paketi seç'}
              </Text>
            </Pressable>
          );
        })}
        <Text style={styles.note}>Prototip: ödeme alınmaz.</Text>
      </View>
    </ScrollView>
  );
}

function CompareBar({ label, ratio }: { label: string; ratio: number }) {
  return (
    <View style={styles.compare}>
      <View style={styles.compareHeader}>
        <Text style={styles.text}>{label}</Text>
        <Text style={styles.text}>{percent(ratio)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fillBar, { width: `${Math.round(ratio * 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 48, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  spaced: { marginTop: 6 },
  flex: { flex: 1 },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  bigPercent: { fontSize: 44, fontWeight: '800', color: colors.text },
  nowInfo: { gap: 4, flex: 1 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  alert: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 8,
  },
  alertTitle: { fontSize: 15, fontWeight: '700', color: colors.primary },
  quote: { fontSize: 14, fontStyle: 'italic', color: colors.text },
  activeNote: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  success: { fontSize: 14, color: colors.success, fontWeight: '600' },
  compare: { gap: 4 },
  compareHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.cream, overflow: 'hidden' },
  fillBar: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  compRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compPercent: { fontSize: 14, fontWeight: '600', color: colors.text, minWidth: 52, textAlign: 'right' },
  input: {
    minHeight: 70,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.cream,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: 'top',
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { color: colors.danger, fontSize: 14 },
  primary: {
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  primaryText: { color: colors.onPrimary, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  campaign: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border, gap: 4 },
  ended: { opacity: 0.5 },
  stats: { fontSize: 12, color: colors.textMuted },
  campaignMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  endText: { color: colors.danger, fontWeight: '600' },
  plan: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 3 },
  planSelected: { borderColor: colors.primary, borderWidth: 2 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  planName: { fontSize: 15, fontWeight: '700', color: colors.text },
  planPrice: { fontSize: 15, fontWeight: '700', color: colors.primary },
  planActive: { marginTop: 4, color: colors.primary, fontWeight: '600' },
  planChoose: { marginTop: 4, color: colors.textMuted },
  note: { textAlign: 'center', color: colors.placeholder, fontSize: 12 },
});
