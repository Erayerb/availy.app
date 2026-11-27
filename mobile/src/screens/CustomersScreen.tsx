import { useEffect,  useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { useOnPageFocus, usePageTop } from '../context/PageContext';
import { Text } from '../components/Text';
import { Pressable } from '../components/Pressable';

import { HeaderButtons } from '../components/HeaderButtons';
import { ReviewsSection } from '../components/ReviewsSection';
import { useLoyalty } from '../context/LoyaltyContext';
import { useReviews } from '../hooks/useReviews';
import type { User } from '../lib/auth';
import { businessApi, type VenueStats } from '../lib/business';
import { colors, themed } from '../theme';
import { InlineIcon } from '../components/Icon';

type Props = {
  venueId: number;
  user: User;
  onOpenUser: (username: string) => void;
  onOpenLoyalty: () => void; // Kampanyalar > Ödüller
};

/** Business "Müşteriler" tab: how often people come (anonymous), loyalty members and the reviews to answer. */
export function CustomersScreen({ venueId, user, onOpenUser, onOpenLoyalty }: Props) {
  const [stats, setStats] = useState<VenueStats | null>(null);
  const { mine } = useLoyalty();
  const { reviews, reload } = useReviews(venueId, user.token);
  // Reviews with words the business has not answered yet (stars alone have nothing to answer)
  const written = reviews.items.filter((r) => r.body?.trim());
  const waiting = written.filter((r) => !r.replies.some((p) => p.is_business)).length;

  const top = usePageTop();
  useOnPageFocus(() => {
    reload();
    if (user.token) businessApi.stats(user.token, venueId).then(setStats).catch(() => {});
  });
  useEffect(() => {
    if (user.token) businessApi.stats(user.token, venueId).then(setStats).catch(() => setStats(null));
  }, [user.token, venueId]);

  return (
    <ScrollView ref={top} style={styles.page} contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
      <View style={styles.topRow}>
        <Text style={styles.title}>Müşteriler</Text>
        <HeaderButtons />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Son 30 gün</Text>
        <View style={styles.stats}>
          <Stat value={stats?.month_people ?? 0} label="Farklı kişi" />
          <Stat value={stats?.regulars ?? 0} label="Müdavim (3+ kez)" />
        </View>
        {stats && stats.top_visits.length > 0 ? (
          <Text style={styles.text}>
            {topVisitsText(stats.top_visits)}
          </Text>
        ) : (
          <Text style={styles.muted}>Müşterilerin check-in yaptıkça burada görürsün.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Sadakat</Text>
        {mine?.program ? (
          <Text style={styles.text}>
            {mine.members} üye
            {mine.program.kind === 'stamps' ? ` · ${mine.stampsGiven} damga verildi` : ''}
            {mine.program.active === false ? ' · program kapalı' : ''}
          </Text>
        ) : (
          <View style={styles.row}>
            <Text style={[styles.muted, styles.flex]}>Damga kartı aç, müşterilerin tekrar gelsin.</Text>
            <Pressable style={styles.button} onPress={onOpenLoyalty}>
              <Text style={styles.buttonText}>Sadakat programı oluştur</Text>
            </Pressable>
          </View>
        )}
        {mine?.program && (
          <Pressable onPress={onOpenLoyalty} hitSlop={6}>
            <Text style={styles.link}>Programı yönet ›</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.sectionTitle}>
        {waiting > 0 ? <><InlineIcon name="message-circle" /> {waiting} yorum yanıt bekliyor</> : written.length > 0 ? '✓ Tüm yorumları yanıtladın' : 'Yorumlar'}
      </Text>
      <ReviewsSection
        venueId={venueId}
        user={user}
        reviews={reviews}
        reload={reload}
        onOpenUser={onOpenUser}
      />
    </ScrollView>
  );
}

/** "En sık gelen müşterin 5 kez geldi" / "En sık gelen 3 müşterin 5, 3 ve 2 kez geldi" (son 30 gün). */
function topVisitsText(visits: number[]): string {
  if (visits.length === 1) return `En sık gelen müşterin ${visits[0]} kez geldi.`;
  const list = `${visits.slice(0, -1).join(', ')} ve ${visits[visits.length - 1]}`;
  return `En sık gelen ${visits.length} müşterin ${list} kez geldi.`;
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
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: TAB_BAR_SPACE, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 20, elevation: 20 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, padding: 10, borderRadius: 14, backgroundColor: colors.cream, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text }, // neutral: a 0 is no alarm
  statLabel: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  button: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.primary },
  buttonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  link: { color: colors.primary, fontWeight: '700' },
}));
