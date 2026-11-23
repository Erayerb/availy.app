import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { send } from '../lib/accountApi';
import { colors, themed } from '../theme';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

type Summary = {
  month: string;
  checkins: number;
  venues: number;
  discoveries: number;
  points: number;
  previous_checkins: number;
  top_venues: { id: number; name: string; district: string | null; visits: number }[];
  top_districts: { district: string; visits: number }[];
  friends: number;
  rank_among_friends: number | null;
  friends_average: number | null;
};

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/** My profile: availo+ "Aylık özet" (this month or last month); without availo+ a short teaser. */
export function MonthlySummary({ token, plus, onUpgrade, onOpenVenue }: { token: string; plus: boolean; onUpgrade: () => void; onOpenVenue: (venue: { id: number }) => void }) {
  const [back, setBack] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (!plus) return;
    send<Summary>('GET', `/v1/me/monthly-summary?months_back=${back}`, undefined, token).then(setSummary).catch(() => setSummary(null));
  }, [token, plus, back]);

  if (!plus) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Aylık özet</Text>
        <Text style={styles.muted}>En çok gittiğin mekanlar ve semtler, geçen aya göre değişim ve arkadaşların arasında kaçıncı olduğun.</Text>
        <Pressable style={styles.primary} onPress={onUpgrade}>
          <Text style={styles.primaryText}>availo+ ile aç</Text>
        </Pressable>
      </View>
    );
  }
  if (!summary) return null;
  const [year, month] = summary.month.split('-').map(Number);
  const change = summary.checkins - summary.previous_checkins;
  // One page per comparison, swiped in order; empty ones are left out
  const pages: { key: string; title: string; body: ReactNode }[] = [
    {
      key: 'numbers',
      title: 'Bu ayın sayıları',
      body: (
        <>
          <View style={styles.row}>
            {[
              { n: summary.checkins, label: 'check-in' },
              { n: summary.venues, label: 'mekan' },
              { n: summary.points, label: 'puan' },
            ].map((s) => (
              <View key={s.label} style={styles.stat}>
                <Text style={styles.statNumber}>{s.n}</Text>
                <Text style={styles.muted}>{s.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.text}>
            {change === 0 ? 'Bir önceki ayla aynı.' : change > 0 ? `Bir önceki aydan ${change} check-in fazla.` : `Bir önceki aydan ${-change} check-in az.`}
            {summary.discoveries ? ` ${summary.discoveries} yeni mekan keşfettin.` : ''}
          </Text>
        </>
      ),
    },
    ...(summary.top_venues.length
      ? [{
          key: 'venues',
          title: 'En çok gittiklerin',
          body: (
            <>
              {summary.top_venues.map((v, i) => (
                <Pressable key={v.id} onPress={() => onOpenVenue({ id: v.id })}>
                  <Text style={styles.text}>
                    {i + 1}. <Text style={styles.bold}>{v.name}</Text> · {v.visits} kez{v.district ? ` · ${v.district}` : ''}
                  </Text>
                </Pressable>
              ))}
            </>
          ),
        }]
      : []),
    ...(summary.top_districts.length
      ? [{
          key: 'districts',
          title: 'Semtlerin',
          body: (
            <>
              {summary.top_districts.map((d, i) => (
                <Text key={d.district} style={styles.text}>
                  {i + 1}. <Text style={styles.bold}>{d.district}</Text> · {d.visits} check-in
                </Text>
              ))}
            </>
          ),
        }]
      : []),
    ...(summary.rank_among_friends !== null
      ? [{
          key: 'friends',
          title: 'Arkadaşlarınla',
          body: (
            <>
              <Text style={styles.big}>{summary.rank_among_friends}. sıradasın</Text>
              <Text style={styles.text}>
                {summary.friends} arkadaşın arasında. Arkadaşların ortalama {summary.friends_average} check-in yaptı, sen {summary.checkins}.
              </Text>
            </>
          ),
        }]
      : []),
  ];
  return (
    <View style={styles.card}>
      <Pressable style={styles.row} onPress={() => setOpen((o) => !o)} accessibilityRole="button">
        <Text style={[styles.title, styles.flex]}>
          Aylık özet · {MONTHS[month - 1]} {year}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
      </Pressable>
      {open && (
        <>
          <View style={styles.tabs}>
            {[0, 1].map((n) => (
              <Pressable key={n} onPress={() => setBack(n)} style={[styles.tab, back === n && styles.tabOn]}>
                <Text style={[styles.tabText, back === n && styles.tabTextOn]}>{n === 0 ? 'Bu ay' : 'Geçen ay'}</Text>
              </Pressable>
            ))}
          </View>
          <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
            {width > 0 && (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
                onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
                scrollEventThrottle={64}
              >
                {pages.map((p) => (
                  <View key={p.key} style={[styles.page, { width }]}>
                    <Text style={styles.label}>{p.title}</Text>
                    {p.body}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
          {pages.length > 1 && (
            <View style={styles.dots}>
              {pages.map((p, i) => (
                <View key={p.key} style={[styles.dot, i === page && styles.dotOn]} />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { padding: 16, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  muted: { fontSize: 13, color: colors.textMuted },
  text: { fontSize: 14, color: colors.text, lineHeight: 20 },
  bold: { fontWeight: '700' },
  label: { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textMuted, marginTop: 4 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: colors.cream },
  statNumber: { fontSize: 20, fontWeight: '800', color: colors.text },
  tabs: { flexDirection: 'row', gap: 4 },
  tab: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.cream },
  tabOn: { backgroundColor: colors.primary },
  tabText: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  tabTextOn: { color: colors.onPrimary },
  page: { gap: 8, paddingRight: 4 },
  big: { fontSize: 20, fontWeight: '800', color: colors.primary },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.primary, width: 16 },
  primary: { paddingVertical: 12, borderRadius: 12, backgroundColor: colors.gold, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
}));
