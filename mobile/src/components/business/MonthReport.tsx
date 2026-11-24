import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useOnPageFocus } from '../../context/PageContext';
import { businessApi, type MonthReport as Report } from '../../lib/business';
import { colors, themed } from '../../theme';
import { MonthPicker } from '../MonthPicker';
import { SummaryButton } from './BusinessSummary';
import { Text } from '../Text';

/** İşletme paneli, every plan: "Kasım 2026 · availo ile 23 kişi geldi, 9'u ilk kez" — what availo brought, one month
 * at a time (the one month picker on the panel). On the Aylık paket: against last month and the month's summary. */
export function MonthReport({ token }: { token: string }) {
  const [back, setBack] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const [months, setMonths] = useState(2); // free plan: this month and last; the Aylık paket says how many
  const load = useCallback(() => {
    businessApi.report(token, back).then(setReport).catch(() => {});
  }, [token, back]);
  useEffect(load, [load]);
  useOnPageFocus(load);
  if (!report) return null;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>availo ile</Text>
        <MonthPicker value={back} onChange={setBack} count={months} />
      </View>
      <Text style={[styles.big, report.people === 0 && styles.bigZero]}>
        {report.people} kişi geldi{report.new_people ? `, ${report.new_people}'i ilk kez` : ''}
      </Text>
      <View style={styles.row}>
        {[
          { n: report.checkins, label: 'check-in' },
          { n: report.coupons_used, label: 'kupon kullanıldı' },
          { n: report.campaigns, label: 'kampanya gönderildi' },
        ].map((s) => (
          <View key={s.label} style={styles.stat}>
            <Text style={styles.statNumber}>{s.n}</Text>
            <Text style={styles.muted}>{s.label}</Text>
          </View>
        ))}
      </View>
      <SummaryButton token={token} back={back} onMonths={setMonths} />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { padding: 14, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  big: { fontSize: 20, fontWeight: '800', color: colors.primary },
  bigZero: { color: colors.text },
  row: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: colors.cream },
  statNumber: { fontSize: 20, fontWeight: '800', color: colors.text },
  muted: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
}));
