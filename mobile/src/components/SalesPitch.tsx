import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { businessApi, type SalesPitch as Pitch } from '../lib/business';
import { colors, themed } from '../theme';
import { Text } from './Text';
import { Pressable } from './Pressable';

/** Yönetici, on a venue page: the numbers to take to the venue ("Geçen hafta 35 kişi check-in yaptı..."). */
export function SalesPitch({ token, venueId }: { token: string; venueId: number }) {
  const [pitch, setPitch] = useState<Pitch | null>(null);
  // Closed by default: one line on the venue page, the numbers when tapped
  const [open, setOpen] = useState(false);
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
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.head} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={styles.title}>Satış özeti (yönetici)</Text>
        <Text style={styles.chevron}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open && lines.map((l) => (
        <Text key={l} style={styles.text}>
          • {l}
        </Text>
      ))}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { padding: 12, borderRadius: 14, backgroundColor: colors.cream, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 14, fontWeight: '800', color: colors.text },
  chevron: { fontSize: 13, color: colors.textMuted },
  text: { fontSize: 13.5, color: colors.text },
}));
