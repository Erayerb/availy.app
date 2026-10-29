import { ScrollView, StyleSheet, View } from 'react-native';

import { BackButton } from '../components/BackButton';
import { Icon, InlineIcon } from '../components/Icon';
import { LEVEL_ICONS } from '../components/LevelCard';
import { Text } from '../components/Text';
import { LEVELS } from '../lib/levels';
import type { Level } from '../lib/safety';
import { colors, themed } from '../theme';

/** Seviyeler: all four levels, how each is reached and what it brings; the person's own one marked. */
export function LevelsScreen({ current, next, onBack }: { current: Level['id'] | null; next?: Level['next']; onBack: () => void }) {
  const rank = LEVELS.findIndex((l) => l.id === current);
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>Seviyeler</Text>
      </View>
      <Text style={styles.muted}>Check-in yaptıkça, mekan keşfettikçe ve rozet kazandıkça seviyen yükselir.</Text>
      {next && (
        <View style={styles.card}>
          <Text style={styles.name}>{next.name} için kalan</Text>
          {next.missing.map((m) => (
            <Text key={m} style={styles.perk}>
              <InlineIcon name="arrow-right" color={colors.primary} /> {m}
            </Text>
          ))}
        </View>
      )}
      {LEVELS.map((level, i) => {
        const mine = level.id === current;
        const reached = rank >= i;
        return (
          <View key={level.id} style={[styles.card, mine && styles.cardMine]}>
            <View style={styles.head}>
              <View style={[styles.badge, reached && styles.badgeOn]}>
                <Icon name={LEVEL_ICONS[level.id]} size={20} color={reached ? colors.onPrimary : colors.textMuted} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.name}>{level.name}</Text>
                <Text style={styles.muted}>{level.needs}</Text>
              </View>
              {mine && <Text style={styles.mine}>Sen buradasın</Text>}
            </View>
            <Text style={styles.label}>Avantajlar</Text>
            {level.perks.map((perk) => (
              <Text key={perk} style={styles.perk}>
                <InlineIcon name="check" color={reached ? colors.success : colors.textMuted} /> {perk}
              </Text>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 48, gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  card: { padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 6 },
  cardMine: { borderColor: colors.primary, borderWidth: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  badgeOn: { backgroundColor: colors.primary },
  flex: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  mine: { fontSize: 12, fontWeight: '700', color: colors.primary },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 4 },
  perk: { fontSize: 14, color: colors.text },
}));
