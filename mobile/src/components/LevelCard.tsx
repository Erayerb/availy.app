import { StyleSheet, View } from 'react-native';

import type { Level } from '../lib/safety';
import { colors, themed } from '../theme';
import { Icon, InlineIcon, type IconName } from './Icon';
import { GradientFill } from './GradientFill';
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

// Each level its own colour, from Yeni gelen (green) up to Semt elçisi (gold)
const LEVEL_GRADIENTS: Record<Level['id'], [string, string]> = {
  newcomer: ['#123A2A', '#2E9E4F'],
  explorer: ['#2B2350', '#7B5EA7'],
  local: ['#7A2E1F', '#C8102E'],
  ambassador: ['#5A3A12', '#C9962B'],
};

/** On the profile: the level on a small coloured card (what comes next: on the Seviyeler page). */
export function LevelCard({ level, onOpen }: { level: Level; onOpen?: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onOpen} disabled={!onOpen} accessibilityRole="button" accessibilityLabel={`Seviye: ${level.name}`}>
      <GradientFill colors={LEVEL_GRADIENTS[level.id] ?? LEVEL_GRADIENTS.newcomer} />
      <View style={styles.badge}>
        <LevelIcon id={level.id} size={19} color="#fff" />
      </View>
      <View style={styles.flex}>
        <Text style={styles.caption}>Seviye</Text>
        <Text style={styles.name}>{level.name}</Text>
      </View>
      {onOpen && <Icon name="arrow-right" size={17} color="rgba(255,255,255,0.85)" />}
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, overflow: 'hidden' },
  badge: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 1 },
  caption: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' },
  name: { fontSize: 16, fontWeight: '800', color: '#fff' },
}));
