import { Pressable, Text } from 'react-native';

import { useEngagement } from '../context/EngagementContext';
import type { Venue } from '../lib/api';
import { canWatch } from '../lib/watch';
import { colors } from '../theme';

/** 🔔 "%70 altına düşünce haber ver" — shown for busy venues (or ones already watched). */
export function WatchButton({ venue, size = 18 }: { venue: Venue; size?: number }) {
  const { watches, toggleWatchFor } = useEngagement();
  const watching = watches.some((w) => w.venueId === venue.id);
  if (!watching && !canWatch(venue)) return null;
  return (
    <Pressable
      onPress={() => toggleWatchFor(venue)}
      hitSlop={10}
      accessibilityLabel={watching ? 'Haber vermeyi kapat' : '%70 altına düşünce haber ver'}
    >
      <Text style={{ fontSize: size, color: watching ? colors.primary : colors.placeholder }}>{watching ? '🔔' : '🔕'}</Text>
    </Pressable>
  );
}
