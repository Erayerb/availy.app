import { StyleSheet } from 'react-native';

import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

import { useEngagement } from '../context/EngagementContext';
import type { Venue } from '../lib/api';
import { canWatch } from '../lib/watch';
import { haptics } from '../lib/haptics';
import { colors, themed } from '../theme';

/** "Sakin olunca haber ver" bell — shown for busy venues (or ones already watched). */
export function WatchButton({ venue, size = 18, labeled = false }: { venue: Venue; size?: number; labeled?: boolean }) {
  const { watches, toggleWatchFor } = useEngagement();
  const watching = watches.some((w) => w.venueId === venue.id);
  if (!watching && !canWatch(venue)) return null;
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        toggleWatchFor(venue);
      }}
      hitSlop={10}
      style={labeled ? [styles.pill, watching && styles.pillOn] : undefined}
      accessibilityLabel={watching ? 'Haber vermeyi kapat' : 'Sakin olunca haber ver'}
    >
      <Icon name={watching ? 'bell-ringing' : 'bell'}
        filled={watching} size={size} color={watching ? colors.primary : labeled ? colors.text : colors.textMuted} />
      {/* With its words (venue page): what the bell does is clear */}
      {labeled && <Text style={[styles.text, watching && styles.textOn]}>{watching ? 'Haber vereceğiz · kapat' : 'Sakin olunca haber ver'}</Text>}
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.cream },
  pillOn: { borderWidth: 1.5, borderColor: colors.primary },
  text: { fontSize: 13, fontWeight: '700', color: colors.text },
  textOn: { color: colors.primary },
}));
