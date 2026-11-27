import { accountApi } from '../lib/accountApi';
import { ScrollView, StyleSheet, View } from 'react-native';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { Text } from '../components/Text';
import { Pressable } from '../components/Pressable';

import { BackButton } from '../components/BackButton';
import { PlanSection } from '../components/business/PlanSection';
import { useSettings } from '../context/SettingsContext';
import type { PlanId } from '../lib/plans';
import { FREE_FEATURES, PREMIUM_PERKS, PREMIUM_PRICE } from '../lib/premium';
import { colors, themed } from '../theme';
import { Icon, type IconName } from '../components/Icon';

type Props = {
  token?: string | null; // a signed-in customer: Premium is saved on the server too
  signedIn: boolean;
  onBack: () => void;
  onLogin: () => void;
  // Business accounts choose their package here instead
  business: { plan: PlanId; onPlanChange: (plan: PlanId) => void } | null;
};

/** B2C plans: free with ads or Premium (demo: switched on without payment); B2B: the business package. */
export function SubscriptionScreen({ signedIn, onBack, onLogin, business, token = null }: Props) {
  const { premium, update } = useSettings();

  if (business) {
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <BackButton onPress={onBack} />
          <Text style={styles.title}>Abonelik</Text>
        </View>
        <PlanSection plan={business.plan} onPlanChange={business.onPlanChange} />
      </ScrollView>
    );
  }

  const choose = (next: boolean) => {
    update({ premium: next });
    if (token) accountApi.setPlan(token, next).catch(() => {});
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>Abonelik</Text>
      </View>

      {/* availo+ first, in gold: what it adds, one line each, and the button in the card */}
      <View style={styles.plus}>
        <View style={styles.plusHead}>
          <View style={styles.plusMark}>
            <Icon name="crown" size={20} color={GOLD_TEXT} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.plusName}>availo+</Text>
            <Text style={styles.plusPrice}>{PREMIUM_PRICE}</Text>
          </View>
          {premium && <Text style={styles.plusBadge}>Mevcut planın</Text>}
        </View>
        {PREMIUM_PERKS.map((perk) => (
          <View key={perk.title} style={styles.perk}>
            <View style={styles.perkIcon}>
              <Icon name={perk.icon as IconName} size={17} color={colors.gold} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.perkTitle}>{perk.title}</Text>
              <Text style={styles.perkText}>{perk.text}</Text>
            </View>
          </View>
        ))}
        {!signedIn ? (
          <Pressable style={styles.gold} onPress={onLogin}>
            <Text style={styles.goldText}>availo+ için giriş yap</Text>
          </Pressable>
        ) : premium ? null : (
          <Pressable style={styles.gold} onPress={() => choose(true)}>
            <Text style={styles.goldText}>availo+'ya geç</Text>
          </Pressable>
        )}
      </View>

      {/* The free plan, quieter */}
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.name}>Ücretsiz</Text>
          {!premium ? <Text style={styles.badge}>Mevcut planın</Text> : <Text style={styles.price}>₺0</Text>}
        </View>
        {FREE_FEATURES.map((f) => (
          <View key={f} style={styles.freeRow}>
            <Icon name={f === 'Reklamlı' ? 'ad' : 'check'} size={14} color={colors.textMuted} />
            <Text style={styles.feature}>{f}</Text>
          </View>
        ))}
        {signedIn && premium && (
          <Pressable style={styles.secondary} onPress={() => choose(false)}>
            <Text style={styles.secondaryText}>Ücretsiz plana dön</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.note}>Prototip: ödeme alınmaz, availo+ tek dokunuşla açılır.</Text>
    </ScrollView>
  );
}

// The points card's gold (Puanların), so availo+ and the rewards read as one family
const GOLD = ['#5A3A12', '#C9962B'] as const;
const GOLD_TEXT = '#2A1A06';

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: TAB_BAR_SPACE, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  flex: { flex: 1 },
  plus: { padding: 16, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: GOLD[1], gap: 12 },
  plusHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  plusMark: { width: 40, height: 40, borderRadius: 20, backgroundColor: GOLD[1], alignItems: 'center', justifyContent: 'center' },
  plusName: { fontSize: 22, fontWeight: '800', color: colors.text },
  plusPrice: { fontSize: 14, fontWeight: '700', color: colors.gold },
  plusBadge: { fontSize: 12, fontWeight: '700', color: colors.gold },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  perkIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  perkTitle: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  perkText: { fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  gold: { marginTop: 4, paddingVertical: 14, borderRadius: 14, backgroundColor: GOLD[1], alignItems: 'center' },
  goldText: { color: GOLD_TEXT, fontSize: 16, fontWeight: '800' },
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  price: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  badge: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  freeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  feature: { flex: 1, fontSize: 13.5, color: colors.text },
  secondary: { marginTop: 4, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  secondaryText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  note: { textAlign: 'center', fontSize: 12, color: colors.placeholder },
}));
