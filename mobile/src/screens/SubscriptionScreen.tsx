import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '../components/BackButton';
import { useSettings } from '../context/SettingsContext';
import { FREE_FEATURES, PREMIUM_FEATURES, PREMIUM_PRICE } from '../lib/premium';
import { colors } from '../theme';

type Props = { signedIn: boolean; onBack: () => void; onLogin: () => void };

/** B2C plans: free with ads or Premium (demo: switched on without payment). */
export function SubscriptionScreen({ signedIn, onBack, onLogin }: Props) {
  const { premium, update } = useSettings();

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>Abonelik</Text>
      </View>

      <Plan name="Ücretsiz" price="₺0" features={FREE_FEATURES} current={!premium} />
      <Plan name="Premium" price={PREMIUM_PRICE} features={PREMIUM_FEATURES} current={premium} highlight />

      {!signedIn ? (
        <Pressable style={styles.primary} onPress={onLogin}>
          <Text style={styles.primaryText}>Premium için giriş yap</Text>
        </Pressable>
      ) : premium ? (
        <Pressable style={styles.secondary} onPress={() => update({ premium: false })}>
          <Text style={styles.secondaryText}>Ücretsiz plana dön</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.primary} onPress={() => update({ premium: true })}>
          <Text style={styles.primaryText}>Premium'a geç</Text>
        </Pressable>
      )}
      <Text style={styles.note}>Prototip: ödeme alınmaz, Premium tek dokunuşla açılır.</Text>
    </ScrollView>
  );
}

function Plan(props: { name: string; price: string; features: string[]; current: boolean; highlight?: boolean }) {
  return (
    <View style={[styles.card, props.current && styles.current]}>
      <View style={styles.header}>
        <Text style={styles.name}>
          {props.highlight ? '⭐ ' : ''}
          {props.name}
        </Text>
        <Text style={styles.price}>{props.price}</Text>
      </View>
      {props.features.map((f) => (
        <Text key={f} style={styles.feature}>
          • {f}
        </Text>
      ))}
      {props.current && <Text style={styles.badge}>✓ Mevcut planın</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 40, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 6 },
  current: { borderColor: colors.primary, borderWidth: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  name: { fontSize: 18, fontWeight: '800', color: colors.text },
  price: { fontSize: 17, fontWeight: '800', color: colors.primary },
  feature: { fontSize: 14, color: colors.text },
  badge: { marginTop: 6, color: colors.primary, fontWeight: '700' },
  primary: { paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  secondary: { paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center' },
  secondaryText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  note: { textAlign: 'center', fontSize: 12, color: colors.placeholder },
});
