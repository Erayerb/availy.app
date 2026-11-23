import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { send } from '../../lib/accountApi';
import { WEEKDAY_NAMES } from '../../lib/business';
import { GradientFill } from '../GradientFill';
import { Icon } from '../Icon';
import { monthName } from '../MonthlySummary';
import { MonthPicker } from '../MonthPicker';
import { Pressable } from '../Pressable';
import { SummaryStory, type StoryPage } from '../SummaryStory';
import { Text } from '../Text';

type Summary = {
  months_available: number;
  month: string;
  checkins: number;
  people: number;
  new_people: number;
  returning_people: number;
  coupons_used: number;
  campaigns: number;
  previous_checkins: number;
  previous_people: number;
  busiest_weekday: number | null;
  busiest_hour: number | null;
  regulars: number;
};

function pagesFor(s: Summary): StoryPage[] {
  const kicker = monthName(s.month);
  const change = s.people - s.previous_people;
  const pages: StoryPage[] = [
    {
      key: 'people',
      icon: 'users',
      colors: ['#13304F', '#2F6AA3'],
      kicker,
      big: String(s.people),
      title: 'kişi availo ile geldi',
      lines: [
        `${s.checkins} check-in`,
        change === 0 ? 'Geçen ayla aynı.' : change > 0 ? `Geçen aydan ${change} kişi fazla.` : `Geçen aydan ${-change} kişi az.`,
      ],
    },
    {
      key: 'new',
      icon: 'user-plus',
      colors: ['#123A2A', '#2E9E4F'],
      kicker,
      big: String(s.new_people),
      title: 'yeni müşteri',
      lines: [`${s.returning_people} kişi tekrar geldi`, s.regulars ? `${s.regulars} kişi 3 günden fazla geldi: müdavimlerin` : 'Damga kartıyla müdavim kazan.'],
    },
  ];
  if (s.busiest_weekday !== null && s.busiest_hour !== null)
    pages.push({
      key: 'busy',
      icon: 'clock',
      colors: ['#5A3A12', '#C9962B'],
      kicker,
      big: `${WEEKDAY_NAMES[s.busiest_weekday - 1]} ${String(s.busiest_hour).padStart(2, '0')}:00`,
      title: 'En kalabalık zamanın',
      lines: ['Sakin saatler için Panel > En sakin saatler: kampanyayı oraya kur.'],
    });
  pages.push({
    key: 'campaigns',
    icon: 'ticket',
    colors: ['#7A2E1F', '#D9480F'],
    kicker,
    big: String(s.coupons_used),
    title: 'kupon kasada kullanıldı',
    lines: [`${s.campaigns} kampanya gönderdin`],
  });
  return pages;
}

/** İşletme paneli, Aylık paket: "Aylık özet" — the month as coloured pages, like the customers' one. */
export function BusinessSummary({ token }: { token: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [open, setOpen] = useState(false);
  const [back, setBack] = useState(0);
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    send<Summary>('GET', `/v1/business/monthly-summary?months_back=${back}`, undefined, token)
      .then((s) => {
        setSummary(s);
        setLocked(false);
      })
      .catch(() => setLocked(true));
  }, [token, back]);
  if (!summary || locked) return null; // not in the plan (402): the panel shows its own lock
  return (
    <>
      <Pressable style={styles.card} onPress={() => setOpen(true)} accessibilityRole="button">
        <GradientFill colors={['#13304F', '#2F6AA3']} />
        <View style={styles.icon}>
          <Icon name="chart-bar" size={22} color="#fff" />
        </View>
        <View style={styles.flex}>
          <Text style={styles.title}>Aylık özet</Text>
          <Text style={styles.sub}>Mekanının ayını görmek için bas</Text>
        </View>
        <MonthPicker value={back} onChange={setBack} count={summary.months_available} light />
      </Pressable>
      <SummaryStory visible={open} pages={pagesFor(summary)} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 18, overflow: 'hidden' },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: '800', color: '#fff' },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  chevron: { fontSize: 26, color: '#fff' },
});
