import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { send } from '../lib/accountApi';
import { colors, themed } from '../theme';
import { GradientFill } from './GradientFill';
import { Icon } from './Icon';
import { MonthPicker } from './MonthPicker';
import { Pressable } from './Pressable';
import { SummaryStory, type StoryPage } from './SummaryStory';
import { Text } from './Text';

type Summary = {
  months_available: number; // the picker: back to the month the person joined
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

export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export const monthName = (month: string) => {
  const [year, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${year}`;
};

/** The pages of "Aylık özet": numbers, the venues and districts most gone to, friends. */
function pagesFor(s: Summary, onOpenVenue: (venue: { id: number }) => void): StoryPage[] {
  const kicker = monthName(s.month);
  const change = s.checkins - s.previous_checkins;
  const pages: StoryPage[] = [
    {
      key: 'checkins',
      icon: 'map-pin',
      colors: ['#7A2E1F', '#C8102E'],
      kicker,
      big: String(s.checkins),
      title: 'check-in yaptın',
      lines: [
        change === 0 ? 'Bir önceki ayla aynı.' : change > 0 ? `Bir önceki aydan ${change} fazla.` : `Bir önceki aydan ${-change} az.`,
        `${s.venues} farklı mekan · ${s.points} puan`,
      ],
    },
  ];
  if (s.discoveries)
    pages.push({ key: 'discoveries', icon: 'sparkles', colors: ['#2B2350', '#7B5EA7'], kicker, big: String(s.discoveries), title: 'yeni mekan keşfettin', lines: ['İlk check-in senindi.'] });
  if (s.top_venues.length) {
    const [first, ...rest] = s.top_venues;
    pages.push({
      key: 'venue',
      icon: 'heart',
      colors: ['#5A3A12', '#C9962B'],
      kicker,
      big: first.name,
      title: `En çok gittiğin yer · ${first.visits} kez`,
      lines: rest.slice(0, 3).map((v, i) => `${i + 2}. ${v.name} · ${v.visits} kez`),
      onPress: () => onOpenVenue({ id: first.id }),
      actionLabel: 'Mekanı aç',
    });
  }
  if (s.top_districts.length)
    pages.push({
      key: 'districts',
      icon: 'map',
      colors: ['#123A2A', '#2E9E4F'],
      kicker,
      big: s.top_districts[0].district,
      title: 'Semtin',
      lines: s.top_districts.map((d) => `${d.district} · ${d.visits} check-in`),
    });
  if (s.rank_among_friends !== null)
    pages.push({
      key: 'friends',
      icon: 'users',
      colors: ['#13304F', '#2F6AA3'],
      kicker,
      big: `${s.rank_among_friends}.`,
      title: `${s.friends} arkadaşın arasında`,
      lines: [`Arkadaşların ortalama ${s.friends_average} check-in yaptı, sen ${s.checkins}.`],
    });
  return pages;
}

/** My profile: "Aylık özetini görmek için bas" → the month as coloured pages (availo+); a teaser without it. */
export function MonthlySummary({ token, plus, onUpgrade, onOpenVenue }: { token: string; plus: boolean; onUpgrade: () => void; onOpenVenue: (venue: { id: number }) => void }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [open, setOpen] = useState(false);
  const [back, setBack] = useState(0);
  useEffect(() => {
    if (!plus) return;
    send<Summary>('GET', `/v1/me/monthly-summary?months_back=${back}`, undefined, token).then(setSummary).catch(() => setSummary(null));
  }, [token, plus, back]);

  return (
    <>
      <Pressable style={styles.card} onPress={() => (plus ? summary && setOpen(true) : onUpgrade())} accessibilityRole="button">
        <GradientFill colors={['#7A2E1F', '#C8102E']} />
        <View style={styles.icon}>
          <Icon name="chart-bar" size={22} color="#fff" />
        </View>
        <View style={styles.flex}>
          <Text style={styles.title}>Aylık özet</Text>
          <Text style={styles.sub}>
            {plus ? 'Aylık özetini görmek için bas' : 'availo+ ile: en çok gittiğin yerler, semtlerin, arkadaşlarınla kıyas'}
          </Text>
        </View>
        {plus ? <MonthPicker value={back} onChange={setBack} count={summary?.months_available ?? 1} light /> : <Text style={styles.chevron}>›</Text>}
      </Pressable>
      {summary && (
        <SummaryStory
          visible={open}
          pages={pagesFor(summary, (v) => {
            setOpen(false);
            onOpenVenue(v);
          })}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 18, overflow: 'hidden' },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: '800', color: '#fff' },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  chevron: { fontSize: 26, color: '#fff' },
}));
