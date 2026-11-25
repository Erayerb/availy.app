import { useCallback, useEffect, useState } from 'react';
import { Tip } from './Tip';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useCampaigns } from '../context/CampaignsContext';
import { businessApi, type VenueReward } from '../lib/business';
import { campaignApi } from '../lib/campaignApi';
import { colors, themed } from '../theme';
import { GradientFill } from './GradientFill';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

/** Venue page: the venue's standing reward ("200 puan = %10 indirim"), taken with points once a week. */
export function VenueRewardCard({ venueId, token, onLogin, style }: { venueId: number; token: string | null; onLogin: () => void; style?: StyleProp<ViewStyle> }) {
  const { points, coupons, reload } = useCampaigns();
  const [reward, setReward] = useState<VenueReward | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const load = useCallback(() => {
    businessApi.venueReward(venueId, token).then(setReward).catch(() => setReward(null));
  }, [venueId, token]);
  useEffect(load, [load]);
  if (!reward) return null;

  const mine = coupons.find((c) => c.campaignId === String(reward.campaign_id) && !c.redeemedAt);
  const again = reward.next_at ? new Date(reward.next_at) : null;
  const free = reward.free ?? null;
  const short = !free && points !== null && points < reward.points;

  const take = async () => {
    if (!token) return onLogin();
    try {
      await campaignApi.claim(token, String(reward.campaign_id));
      setNote(null);
      await reload();
      load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Alınamadı.');
    }
  };

  return (
    <View style={style}>
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.iconBox}>
          <GradientFill colors={['#5A3A12', '#C9962B']} />
          <Icon name="gift" size={18} color="#fff" />
        </View>
        <View style={styles.flex}>
          <Text style={styles.title}>availo ödülü: %{reward.discount} indirim</Text>
          <Text style={styles.muted}>{reward.points} puanla al, kasada göster · haftada bir</Text>
        </View>
      </View>
      {mine ? (
        <View style={styles.code}>
          <Text style={styles.codeText}>{mine.code}</Text>
          <Text style={styles.muted}>Kasada göster · Kampanyalar → Kuponlarım</Text>
        </View>
      ) : again ? (
        <Text style={styles.muted}>Bu haftaki ödülünü aldın; tekrar {again.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}.</Text>
      ) : (
        <Tip
          id="rewardPoints"
          radius={12}
          text="Check-in'lerle topladığın puanlar burada işe yarar: mekanın ödülünü puanla al, kasada kodu göster. Seviyen ve sıralaman düşmez."
        >
        <Pressable style={[styles.button, short && styles.off]} onPress={take} disabled={short}>
          <Text style={styles.buttonText}>
            {free === 'welcome'
              ? 'Hoş geldin hediyen: puansız al'
              : short
                ? `${reward.points - (points ?? 0)} puan daha gerekiyor`
                : `${reward.points} puanla al`}
          </Text>
        </Pressable>
        </Tip>
      )}
      {note && <Text style={styles.error}>{note}</Text>}
    </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { padding: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.gold, gap: 10 },
  head: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  iconBox: { width: 40, height: 40, borderRadius: 11, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  button: { paddingVertical: 10, borderRadius: 12, backgroundColor: colors.gold, alignItems: 'center' },
  off: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  code: { alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.gold },
  codeText: { fontSize: 20, fontWeight: '800', letterSpacing: 2, color: colors.text },
  error: { fontSize: 13, color: colors.danger },
}));
