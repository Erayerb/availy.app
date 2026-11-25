import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { send } from '../../lib/accountApi';
import { WEEKDAY_NAMES } from '../../lib/business';
import { GradientFill } from '../GradientFill';
import { Icon } from '../Icon';
import { monthName } from '../MonthlySummary';
import { Pressable } from '../Pressable';
import { SummaryStory, type StoryPage } from '../SummaryStory';
import { Text } from '../Text';
import { colors, themed } from '../../theme';

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

/** In the month card (İşletme paneli), Aylık paket: against last month, and "Ayın özetini aç" — the month as
 * coloured pages, like the customers' one. Nothing on the free plan (the endpoint says 402). `onMonths`: how many
 * months can be picked. */
export function SummaryButton({ token, back, onMonths }: { token: string; back: number; onMonths: (n: number) => void }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    send<Summary>('GET', `/v1/business/monthly-summary?months_back=${back}`, undefined, token)
      .then((s) => {
        setSummary(s);
        onMonths(s.months_available);
      })
      .catch(() => setSummary(null));
  }, [token, back]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!summary) return null;
  const change = summary.people - summary.previous_people;
  return (
    <>
      <Text style={change > 0 ? styles.up : change < 0 ? styles.down : styles.same}>
        {change === 0 ? 'Geçen ayla aynı' : change > 0 ? `Geçen aydan ${change} kişi fazla` : `Geçen aydan ${-change} kişi az`}
      </Text>
      <Pressable style={styles.card} onPress={() => setOpen(true)} accessibilityRole="button">
        <GradientFill colors={['#13304F', '#2F6AA3']} />
        <View style={styles.icon}>
          <Icon name="chart-bar" size={18} color="#fff" />
        </View>
        <Text style={styles.title}>Ayın özetini aç</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      <SummaryStory visible={open} pages={pagesFor(summary)} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, overflow: 'hidden' },
  icon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 15, fontWeight: '800', color: '#fff' },
  chevron: { fontSize: 22, color: '#fff' },
  up: { fontSize: 13, fontWeight: '700', color: colors.success },
  down: { fontSize: 13, fontWeight: '700', color: colors.danger },
  same: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
}));
