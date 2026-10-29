import { StyleSheet, View } from 'react-native';

import type { Level } from '../lib/safety';
import { colors, themed } from '../theme';
import { Icon, type IconName } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

export const LEVEL_ICONS: Record<Level['id'], IconName> = {
  newcomer: 'seedling',
  explorer: 'compass',
  local: 'building-community',
  ambassador: 'flag',
};

/** On the profile: the level with its icon, "Kâşif → Mahalleli" on my own (what is left: on the Seviyeler page). */
export function LevelCard({ level, onOpen }: { level: Level; onOpen?: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onOpen} disabled={!onOpen} accessibilityRole="button" accessibilityLabel={`Seviye: ${level.name}`}>
      <View style={[styles.badge, level.rank >= 2 && styles.badgeHigh]}>
        <Icon name={LEVEL_ICONS[level.id]} size={18} color={level.rank >= 2 ? colors.onPrimary : colors.primary} />
      </View>
      <View style={[styles.flex, styles.names]}>
        <Text style={styles.name}>{level.name}</Text>
        {level.next && (
          <>
            <Icon name="arrow-right" size={16} color={colors.textMuted} />
            <Text style={styles.next}>{level.next.name}</Text>
          </>
        )}
      </View>
      {onOpen && <Text style={styles.chevron}>›</Text>}
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  badgeHigh: { backgroundColor: colors.primary },
  flex: { flex: 1 },
  names: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  next: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  chevron: { fontSize: 22, color: colors.textMuted },
}));
