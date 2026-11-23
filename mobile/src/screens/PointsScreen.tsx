import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { BackButton } from '../components/BackButton';
import { GradientFill } from '../components/GradientFill';
import { Icon } from '../components/Icon';
import { Pressable } from '../components/Pressable';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { Text } from '../components/Text';
import { useLocation } from '../context/LocationContext';
import { useOnPageFocus } from '../context/PageContext';
import { usePullRefresh } from '../hooks/usePullRefresh';
import { send } from '../lib/accountApi';
import { shortDate } from '../lib/crowd';
import { formatDistance } from '../lib/geo';
import { colors, themed } from '../theme';

type Wallet = { balance: number; earned: number; spent: number; moves: { at: string; amount: number; label: string; venue_name: string | null }[] };
type Offer = { campaign_id: number; standing: boolean; points: number; discount: number | null; message: string; venue_id: number; venue_name: string; district: string | null; distance_m: number | null };

/** Puanların: the spendable balance (and why it differs from the ranking), what points buy nearby, and the history. */
export function PointsScreen({ token, onBack, onOpenVenue }: { token: string; onBack: () => void; onOpenVenue: (venue: { id: number }) => void }) {
  const { point } = useLocation();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [all, setAll] = useState(false);
  const load = useCallback(() => {
    send<Wallet>('GET', '/v1/me/wallet', undefined, token).then(setWallet).catch(() => {});
    send<Offer[]>('GET', `/v1/rewards${point ? `?lat=${point.lat}&lon=${point.lon}` : ''}`).then(setOffers).catch(() => {});
  }, [token, point?.lat, point?.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(load, [load]);
  useOnPageFocus(load);
  const pull = usePullRefresh(load);
  const moves = wallet ? (all ? wallet.moves : wallet.moves.slice(0, 8)) : [];

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} refreshControl={<RefreshControl {...pull} tintColor={colors.primary} />}>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>Puanların</Text>
      </View>

      <View style={styles.hero}>
        <GradientFill colors={['#5A3A12', '#C9962B']} />
        <Text style={styles.heroLabel}>Sıralama puanın</Text>
        <Text style={styles.heroNumber}>{wallet?.earned ?? '…'}</Text>
        {wallet && (
          <View style={styles.spendable}>
            <Text style={styles.spendableText}>Harcanabilir: {wallet.balance}</Text>
          </View>
        )}
      </View>
      <View style={styles.explain}>
        <Icon name="bulb" size={18} color={colors.gold} />
        <Text style={styles.explainText}>Harcadığın puanlar sıralamanı ve seviyeni etkilemez.</Text>
      </View>

      <Text style={styles.section}>Puanla alabileceklerin</Text>
      {offers.length === 0 && <Text style={styles.muted}>Yakında puanla alınabilecek bir ödül yok. Mekanlar ekledikçe burada görünür.</Text>}
      {offers.map((o) => {
        const enough = (wallet?.balance ?? 0) >= o.points;
        return (
          <Pressable key={o.campaign_id} style={styles.offer} onPress={() => onOpenVenue({ id: o.venue_id })}>
            <View style={styles.offerIcon}>
              <Text style={styles.offerEmoji}>{o.standing ? '🎁' : '🎟️'}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.offerTitle}>
                {o.discount ? `%${o.discount} indirim` : 'Özel kupon'} · {o.venue_name}
              </Text>
              <Text style={styles.muted}>
                {o.standing ? 'Kalıcı ödül, haftada bir' : 'Özel kupon, kampanya bitene kadar'}
                {o.distance_m !== null ? ` · ${formatDistance(o.distance_m / 1000)}` : o.district ? ` · ${o.district}` : ''}
              </Text>
            </View>
            <View style={[styles.price, enough && styles.priceOk]}>
              <Text style={[styles.priceText, enough && styles.priceTextOk]}>{o.points}</Text>
            </View>
          </Pressable>
        );
      })}

      <Text style={styles.section}>Geçmiş</Text>
      {wallet && wallet.moves.length === 0 && <Text style={styles.muted}>Henüz puan hareketin yok. İlk check-in'inle başla.</Text>}
      <View style={styles.card}>
        {moves.map((m, i) => (
          <View key={`${m.at}-${i}`} style={[styles.move, i > 0 && styles.divider]}>
            <View style={styles.flex}>
              <Text style={styles.moveLabel}>{m.label}</Text>
              <Text style={styles.muted}>
                {m.venue_name ? `${m.venue_name} · ` : ''}
                {shortDate(m.at, new Date())}
              </Text>
            </View>
            <Text style={[styles.amount, m.amount < 0 ? styles.minus : styles.plus]}>{m.amount > 0 ? `+${m.amount}` : m.amount}</Text>
          </View>
        ))}
      </View>
      {wallet && wallet.moves.length > moves.length && (
        <Pressable onPress={() => setAll(true)}>
          <Text style={styles.more}>Tümünü gör</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: TAB_BAR_SPACE, gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  hero: { borderRadius: 20, overflow: 'hidden', padding: 22, alignItems: 'center', gap: 2 },
  heroLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '700' },
  heroNumber: { color: '#fff', fontSize: 40, fontWeight: '900' },
  spendable: { marginTop: 6, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)' },
  spendableText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  explain: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14, backgroundColor: colors.cream },
  explainText: { flex: 1, fontSize: 13.5, color: colors.text, lineHeight: 19 },
  section: { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textMuted, marginTop: 6 },
  muted: { fontSize: 13, color: colors.textMuted },
  offer: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  offerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  offerEmoji: { fontSize: 20 },
  flex: { flex: 1, gap: 2 },
  offerTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  price: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.cream },
  priceOk: { backgroundColor: colors.gold },
  priceText: { fontSize: 14, fontWeight: '800', color: colors.textMuted },
  priceTextOk: { color: '#fff' },
  card: { borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  move: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  moveLabel: { fontSize: 14.5, fontWeight: '600', color: colors.text },
  amount: { fontSize: 15, fontWeight: '800' },
  plus: { color: colors.success },
  minus: { color: colors.danger },
  more: { color: colors.primary, fontWeight: '700', textAlign: 'center' },
}));
