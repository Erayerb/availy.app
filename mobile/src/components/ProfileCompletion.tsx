import { StyleSheet, View } from 'react-native';

import type { ProfileStep } from '../lib/auth';
import { colors, themed } from '../theme';
import type { Screen } from './TabBar';
import { InlineIcon } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

/** Daha fazla, personal accounts: "Profilin %80 dolu" until the Tam Profil badge (+20 puan); opens the profile. */
export function ProfileCompletion({ steps, onOpen }: { steps: ProfileStep[]; onOpen: (screen: Screen) => void }) {
  const done = steps.filter((s) => s.done).length;
  if (!steps.length || done === steps.length) return null;
  const percent = Math.round((done / steps.length) * 100);
  const missing = steps.filter((s) => !s.done).map((s) => s.label);
  return (
    <Pressable style={styles.card} onPress={() => onOpen('profile')} accessibilityRole="button">
      <View style={styles.head}>
        <Text style={styles.title}>Profilin %{percent} dolu</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.muted}>Eksik: {missing.join(', ')}</Text>
      <Text style={styles.muted}>
        <InlineIcon name="award" color={colors.gold} /> Tamamlayınca Tam Profil rozeti ve +20 puan
      </Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  chevron: { fontSize: 22, color: colors.textMuted },
  muted: { fontSize: 13, color: colors.textMuted },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.cream, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
}));
