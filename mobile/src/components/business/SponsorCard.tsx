import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useOnPageFocus } from '../../context/PageContext';
import { sponsorsApi, type SponsorStatus } from '../../lib/sponsors';
import { colors, themed } from '../../theme';
import { GradientFill } from '../GradientFill';
import { Icon } from '../Icon';
import { Pressable } from '../Pressable';
import { Text } from '../Text';

const OPTIONS: { days: 7 | 30; label: string; price: string }[] = [
  { days: 7, label: '1 hafta', price: '₺300' },
  { days: 30, label: '1 ay', price: '₺1.000' },
];

/** İşletme paneli > "Öne çık": be shown first on the home page ("Sponsorlu"), and what it brought. */
export function SponsorCard({ token }: { token: string }) {
  const [status, setStatus] = useState<SponsorStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    sponsorsApi.status(token).then(setStatus).catch(() => {});
  }, [token]);
  useEffect(load, [load]);
  useOnPageFocus(load);

  const ask = async (days: 7 | 30) => {
    try {
      setStatus(await sponsorsApi.request(token, days));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gönderilemedi.');
    }
  };

  if (!status) return null;
  const ends = status.active ? new Date(status.active.ends_at) : null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.iconBox}>
          <GradientFill colors={['#5A3A12', '#C9962B']} />
          <Icon name="speakerphone" size={18} color="#fff" />
        </View>
        <View style={styles.flex}>
          <Text style={styles.title}>Öne çık</Text>
          <Text style={styles.muted}>Ana sayfada en üstte, "Sponsorlu" etiketiyle görün.</Text>
        </View>
      </View>

      {ends ? (
        <Text style={styles.live}>
          <Icon name="circle-check" size={14} color={colors.success} /> Yayında ·{' '}
          {ends.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} tarihine kadar
        </Text>
      ) : status.requested_days ? (
        <Text style={styles.muted}>
          {status.requested_days === 7 ? '1 haftalık' : '1 aylık'} talebin alındı; onaylanınca yayına girer. Ödeme sistemi yakında.
        </Text>
      ) : (
        <View style={styles.options}>
          {OPTIONS.map((o) => (
            <Pressable key={o.days} onPress={() => ask(o.days)} style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
              <Text style={styles.optionLabel}>{o.label}</Text>
              <Text style={styles.optionPrice}>{o.price}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}

      {/* What it brought (last 30 days) */}
      <View style={styles.stats}>
        {[
          { n: status.views, label: 'gösterim' },
          { n: status.taps, label: 'tıklama' },
          { n: status.checkins, label: 'check-in' },
        ].map((s) => (
          <View key={s.label} style={styles.stat}>
            <Text style={styles.statNumber}>{s.n}</Text>
            <Text style={styles.muted}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { padding: 14, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 11, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  live: { fontSize: 14, fontWeight: '700', color: colors.success },
  options: { flexDirection: 'row', gap: 10 },
  option: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: colors.gold },
  optionLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  optionPrice: { fontSize: 13, color: colors.gold, fontWeight: '700' },
  pressed: { opacity: 0.8 },
  error: { fontSize: 13, color: colors.danger },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: colors.cream },
  statNumber: { fontSize: 20, fontWeight: '800', color: colors.text },
}));
