import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { businessApi, type SalesPitch as Pitch } from '../lib/business';
import { colors, themed } from '../theme';
import { Text } from './Text';

/** Yönetici, on a venue page: the numbers to take to the venue ("Geçen hafta 35 kişi check-in yaptı..."). */
export function SalesPitch({ token, venueId }: { token: string; venueId: number }) {
  const [pitch, setPitch] = useState<Pitch | null>(null);
  useEffect(() => {
    businessApi.pitch(token, venueId).then(setPitch).catch(() => setPitch(null));
  }, [token, venueId]);
  if (!pitch) return null;
  const lines = [
    `Son 7 gün: ${pitch.week_people} kişi, ${pitch.week_checkins} check-in`,
    pitch.busiest_hour !== null ? `En kalabalık saat: ${String(pitch.busiest_hour).padStart(2, '0')}:00` : null,
    `Son 30 gün: ${pitch.month_checkins} check-in · ${pitch.favorites} kişinin favorisi`,
    pitch.reviews ? `${pitch.reviews} yorum, ortalama ${pitch.rating}★` : null,
    pitch.nearby_joined ? `1 km içinde ${pitch.nearby_joined} mekan availo'da` : null,
    pitch.joined ? 'İşletme hesabı var.' : 'İşletme hesabı yok: görüşmede bu rakamları göster.',
  ].filter(Boolean);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Satış özeti (yönetici)</Text>
      {lines.map((l) => (
        <Text key={l} style={styles.text}>
          • {l}
        </Text>
      ))}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { padding: 12, borderRadius: 14, backgroundColor: colors.cream, gap: 4 },
  title: { fontSize: 14, fontWeight: '800', color: colors.text },
  text: { fontSize: 13.5, color: colors.text },
}));
