import { StyleSheet, View } from 'react-native';
import { Text } from './Text';

import type { Badge } from '../lib/auth';
import { colors, themed } from '../theme';
import { Icon, InlineIcon, type IconName } from './Icon';

// The server's badge ids and their icons (Tabler); an unknown one gets the medal
const BADGE_ICONS: Record<string, IconName> = {
  profile: 'user-check',
  first_step: 'shoe',
  explorer: 'sparkles',
  great_explorer: 'compass',
  traveller: 'map',
  regular: 'coffee',
  night_owl: 'moon',
  helper: 'heart-handshake',
};
export const badgeIcon = (id: string | undefined): IconName => (id && BADGE_ICONS[id]) || 'award';

/** Round badges: earned ones in colour, locked ones grey with their progress ("1/5"). */
export function BadgeGrid({ badges }: { badges: Badge[] }) {
  const earned = badges.filter((b) => b.earned).length;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        Rozetler · {earned}/{badges.length}
      </Text>
      <View style={styles.grid}>
        {badges.map((badge) => (
          <View key={badge.id} style={styles.item} accessibilityLabel={`${badge.name}: ${badge.description}`}>
            <View style={[styles.circle, badge.earned ? styles.earned : styles.locked]}>
              <View style={!badge.earned && styles.iconLocked}>
                <Icon name={badgeIcon(badge.id)} size={24} color={badge.earned ? colors.primary : colors.textMuted} />
              </View>
              {!badge.earned && <Text style={styles.lock}><InlineIcon name="lock" /></Text>}
            </View>
            <Text style={[styles.name, !badge.earned && styles.muted]} numberOfLines={1}>
              {badge.name}
            </Text>
            <Text style={styles.description} numberOfLines={2}>
              {badge.description}
            </Text>
            {!badge.earned && (
              <Text style={styles.progress}>
                {badge.progress}/{badge.target}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const SIZE = 64;

const styles = themed(() => StyleSheet.create({
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 12 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  item: { width: '33.33%', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  circle: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  earned: { backgroundColor: colors.cream, borderWidth: 3, borderColor: colors.primary },
  locked: { backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed' },
  icon: { fontSize: 30 },
  iconLocked: { opacity: 0.25 },
  lock: { position: 'absolute', right: -2, bottom: -2, fontSize: 16 },
  name: { fontSize: 13, fontWeight: '700', color: colors.text, textAlign: 'center' },
  muted: { color: colors.textMuted },
  description: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  progress: { fontSize: 11, fontWeight: '700', color: colors.primary },
}));
