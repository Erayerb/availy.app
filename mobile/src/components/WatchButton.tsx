import { Icon } from './Icon';
import { Pressable } from './Pressable';

import { useEngagement } from '../context/EngagementContext';
import type { Venue } from '../lib/api';
import { canWatch } from '../lib/watch';
import { colors } from '../theme';

/** "Sakin olunca haber ver" bell — shown for busy venues (or ones already watched). */
export function WatchButton({ venue, size = 18 }: { venue: Venue; size?: number }) {
  const { watches, toggleWatchFor } = useEngagement();
  const watching = watches.some((w) => w.venueId === venue.id);
  if (!watching && !canWatch(venue)) return null;
  return (
    <Pressable
      onPress={() => toggleWatchFor(venue)}
      hitSlop={10}
      accessibilityLabel={watching ? 'Haber vermeyi kapat' : 'Sakin olunca haber ver'}
    >
      <Icon name={watching ? 'notifications' : 'notifications-off-outline'} size={size} color={watching ? colors.primary : colors.textMuted} />
    </Pressable>
  );
}
