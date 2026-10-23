import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useCampaigns } from '../../context/CampaignsContext';
import { useEngagement } from '../../context/EngagementContext';
import { useSettings } from '../../context/SettingsContext';
import { fetchHistory, type Venue } from '../../lib/api';
import { campaignTotals, WEEKDAYS, type History } from '../../lib/history';
import { classify } from '../../lib/dummyOccupancy';
import { percent } from '../../lib/stats';
import { colors, themed } from '../../theme';
import { Chip } from '../TagChips';
import { panel } from './panelStyles';

const HEIGHT = 90;

/** Weekly (by weekday) and monthly (by day) occupancy, plus campaign results for the period. */
export function StatsSection({ venue }: { venue: Venue }) {
  const [period, setPeriod] = useState<7 | 30>(7);
  const [history, setHistory] = useState<History | null>(null);
  const { campaigns } = useCampaigns();
  const { views, coupons } = useEngagement();
  const { look } = useSettings();

  useEffect(() => {
    const controller = new AbortController();
    fetchHistory(venue.id, 30, controller.signal)
      .then(setHistory)
      .catch(() => setHistory(null));
    return () => controller.abort();
  }, [venue.id]);

  const totals = campaignTotals(campaigns, views, coupons, venue.id, period);
  const bars =
    history === null
      ? []
      : period === 7
        ? history.weekday.map((ratio, i) => ({ key: WEEKDAYS[i], label: WEEKDAYS[i], ratio }))
        : history.daily.map((d, i) => ({ key: d.date, label: i % 5 === 0 ? d.date.slice(8) : '', ratio: d.ratio }));
  const quietest = bars.length ? bars.reduce((a, b) => (b.ratio < a.ratio ? b : a)) : null;
  // A "quietest day" only means something when the days differ
  const flat = bars.length > 0 && bars.every((b) => b.ratio === bars[0].ratio);

  return (
    <View style={panel.card}>
      <Text style={panel.sectionTitle}>Haftalık / aylık istatistik</Text>
      <View style={panel.wrap}>
        <Chip label="Haftalık" active={period === 7} onPress={() => setPeriod(7)} />
        <Chip label="Aylık" active={period === 30} onPress={() => setPeriod(30)} />
      </View>
      <Text style={panel.muted}>
        {period === 7 ? 'Son 30 günde haftanın günlerine göre ortalama doluluk' : 'Son 30 günün günlük ortalama doluluğu'}
      </Text>
      {bars.length > 0 && (
        <>
          <View style={styles.bars}>
            {bars.map((b) => (
              <View key={b.key} style={styles.slot}>
                <View style={[styles.bar, { height: Math.max(3, b.ratio * HEIGHT), backgroundColor: look(classify(b.ratio)).color }]} />
              </View>
            ))}
          </View>
          <View style={styles.labels}>
            {bars.map((b) => (
              <Text key={b.key} style={styles.label}>
                {b.label}
              </Text>
            ))}
          </View>
        </>
      )}
      {flat && <Text style={panel.text}>Bu dönemde doluluk her gün aynı ({percent(bars[0].ratio)}).</Text>}
      {quietest && !flat && period === 7 && (
        <Text style={panel.text}>
          En sakin gün: {quietest.label} ({percent(quietest.ratio)}). Bu güne zamanlanmış kampanya iyi bir fikir olabilir.
        </Text>
      )}
      <Text style={panel.label}>{period === 7 ? 'Son 7 gün' : 'Son 30 gün'} kampanya sonuçları</Text>
      <Text style={panel.text}>
        📣 {totals.campaigns} kampanya · 👁 {totals.views} gösterim · 🎟 {totals.claims} kupon · ✅ {totals.redemptions} kullanım
      </Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  bars: { height: HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  slot: { flex: 1, justifyContent: 'flex-end' },
  bar: { borderRadius: 3 },
  labels: { flexDirection: 'row', gap: 2 },
  label: { flex: 1, fontSize: 10, color: colors.textMuted, textAlign: 'center' },
}));
