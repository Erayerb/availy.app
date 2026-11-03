import { StyleSheet, View } from 'react-native';

import type { Level } from '../lib/safety';
import { colors, themed } from '../theme';
import { Icon, InlineIcon, type IconName } from './Icon';
import { Pressable } from './Pressable';
import { TabIcon, type IconName as TabIconName } from './TabIcon';
import { Text } from './Text';

// In a line of text (font)
const LEVEL_ICONS: Record<Level['id'], IconName> = {
  newcomer: 'seedling',
  explorer: 'compass',
  local: 'building-community',
  ambassador: 'crown',
};

const LEVEL_DRAWINGS: Record<Level['id'], TabIconName> = { newcomer: 'seedling', explorer: 'compass', local: 'community', ambassador: 'crown' };

/** A level's drawn icon, for the round badges. */
export function LevelIcon({ id, size, color }: { id: Level['id']; size: number; color: string }) {
  return <TabIcon name={LEVEL_DRAWINGS[id]} size={size} color={color} active={false} />;
}

/** Next to a user name (ranking, Akış): the level's small icon; Yeni gelen has none. */
export function LevelMark({ level, plain = false }: { level?: string | null; plain?: boolean }) {
  if (!level || level === 'newcomer' || !(level in LEVEL_ICONS)) return null;
  // plain: the line's own colour (on a coloured row)
  const color = plain ? undefined : level === 'ambassador' ? colors.gold : level === 'local' ? colors.primary : colors.discovery;
  return (
    <>
      {' '}
      <InlineIcon name={LEVEL_ICONS[level as Level['id']]} color={color} />
    </>
  );
}

/** On the profile: the level with its icon, "Kâşif → Mahalleli" on my own (what is left: on the Seviyeler page). */
export function LevelCard({ level, onOpen }: { level: Level; onOpen?: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onOpen} disabled={!onOpen} accessibilityRole="button" accessibilityLabel={`Seviye: ${level.name}`}>
      <View style={[styles.badge, level.rank >= 2 && styles.badgeHigh]}>
        <LevelIcon id={level.id} size={20} color={level.rank >= 2 ? colors.onPrimary : colors.primary} />
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
