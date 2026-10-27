import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '../components/Pressable';

import { HeaderButtons } from '../components/HeaderButtons';
import { ReviewsSection } from '../components/ReviewsSection';
import { useLoyalty } from '../context/LoyaltyContext';
import { useReviews } from '../hooks/useReviews';
import type { User } from '../lib/auth';
import { businessApi, type VenueStats } from '../lib/business';
import { colors, themed } from '../theme';

type Props = {
  venueId: number;
  user: User;
  onOpenUser: (username: string) => void;
  onRegister: () => void;
  onOpenLoyalty: () => void; // Kampanyalar > Sadakat programım
};

/** Business "Müşteriler" tab: how often people come (anonymous), loyalty members and the reviews to answer. */
export function CustomersScreen({ venueId, user, onOpenUser, onRegister, onOpenLoyalty }: Props) {
  const [stats, setStats] = useState<VenueStats | null>(null);
  const { mine } = useLoyalty();
  const { reviews, setReviews, reload } = useReviews(venueId, user.token);
  // Reviews the business has not answered yet
  const waiting = reviews.items.filter((r) => !r.replies.some((p) => p.is_business)).length;

  useEffect(() => {
    if (user.token) businessApi.stats(user.token, venueId).then(setStats).catch(() => setStats(null));
  }, [user.token, venueId]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <Text style={styles.title}>Müşteriler</Text>
        <HeaderButtons />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Son 30 gün</Text>
        <View style={styles.stats}>
          <Stat value={stats?.month_people ?? 0} label="farklı kişi" />
          <Stat value={stats?.regulars ?? 0} label="müdavim (3+ kez)" />
        </View>
        {stats && stats.top_visits.length > 0 ? (
          <Text style={styles.text}>
            En sık gelenler: {stats.top_visits.map((n) => `${n} kez`).join(', ')}
          </Text>
        ) : (
          <Text style={styles.muted}>Henüz check-in yok.</Text>
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
            <Text style={[styles.muted, styles.flex]}>Henüz sadakat programın yok.</Text>
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
        {waiting > 0 ? `💬 ${waiting} yorum yanıt bekliyor` : reviews.count > 0 ? '✓ Tüm yorumları yanıtladın' : 'Yorumlar'}
      </Text>
      <ReviewsSection
        venueId={venueId}
        user={user}
        reviews={reviews}
        onChange={setReviews}
        reload={reload}
        onRegister={onRegister}
        onOpenUser={onOpenUser}
      />
    </ScrollView>
  );
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
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 48, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, padding: 10, borderRadius: 14, backgroundColor: colors.cream, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.primary },
  statLabel: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  button: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.primary },
  buttonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  link: { color: colors.primary, fontWeight: '700' },
}));
