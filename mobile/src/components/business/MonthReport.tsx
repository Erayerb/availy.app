import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useOnPageFocus } from '../../context/PageContext';
import { businessApi, type MonthReport as Report } from '../../lib/business';
import { colors, themed } from '../../theme';
import { Pressable } from '../Pressable';
import { Text } from '../Text';

/** İşletme paneli, every plan: "Bu ay availo ile 23 kişi geldi, 9'u ilk kez" — what availo brought. */
export function MonthReport({ token }: { token: string }) {
  const [back, setBack] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const load = useCallback(() => {
    businessApi.report(token, back).then(setReport).catch(() => {});
  }, [token, back]);
  useEffect(load, [load]);
  useOnPageFocus(load);
  if (!report) return null;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{back === 0 ? 'Bu ay' : 'Geçen ay'} availo ile</Text>
        <View style={styles.tabs}>
          {[0, 1].map((n) => (
            <Pressable key={n} onPress={() => setBack(n)} style={[styles.tab, back === n && styles.tabOn]}>
              <Text style={[styles.tabText, back === n && styles.tabTextOn]}>{n === 0 ? 'Bu ay' : 'Geçen ay'}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Text style={styles.big}>
        {report.people} kişi geldi{report.new_people ? `, ${report.new_people}'i ilk kez` : ''}
      </Text>
      <View style={styles.row}>
        {[
          { n: report.checkins, label: 'check-in' },
          { n: report.coupons_used, label: 'kupon kullanıldı' },
          { n: report.campaigns, label: 'kampanya' },
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
  card: { padding: 14, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  big: { fontSize: 20, fontWeight: '800', color: colors.primary },
  row: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: colors.cream },
  statNumber: { fontSize: 20, fontWeight: '800', color: colors.text },
  muted: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  tabs: { flexDirection: 'row', gap: 4 },
  tab: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.cream },
  tabOn: { backgroundColor: colors.primary },
  tabText: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  tabTextOn: { color: colors.onPrimary },
}));
