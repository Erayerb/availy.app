import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useLocation } from '../context/LocationContext';
import { useOnPageFocus } from '../context/PageContext';
import { useVenuesByIds } from '../hooks/useVenuesByIds';
import type { Venue } from '../lib/api';
import { timeAgo } from '../lib/crowd';
import { friendsApi, placesFromFriends, type Friend } from '../lib/friends';
import { distanceKm, formatDistance } from '../lib/geo';
import { colors, themed } from '../theme';
import { Avatar } from './Avatar';
import { Text } from './Text';
import { VenueTile } from './VenueTile';

const TILE = 150;
type Props = { token: string | null; onOpenVenue: (venue: Venue) => void };

/** Home: "Arkadaşlarının gittiği yerler", a row of cards; hidden when there is nothing to show. */
export function FriendsPlaces({ token, onOpenVenue }: Props) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const load = useCallback(() => {
    if (token) friendsApi.list(token).then((lists) => setFriends(lists.friends)).catch(() => {});
  }, [token]);
  useEffect(load, [load]);
  useOnPageFocus(load);

  const places = useMemo(() => placesFromFriends(friends, new Date()), [friends]);
  const { venues } = useVenuesByIds(places.map((p) => p.venueId));
  const { point } = useLocation();
  const byId = new Map(venues.map((v) => [v.id, v]));
  const shown = places.filter((p) => byId.has(p.venueId));
  if (!token || shown.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Arkadaşlarının gittiği yerler</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {shown.map((place) => {
          const venue = byId.get(place.venueId)!;
          const first = place.people[0];
          const who = first.name || `@${first.username}`;
          return (
            <View key={place.venueId} style={{ width: TILE }}>
              <VenueTile
                venue={venue}
                size={TILE}
                distance={point ? formatDistance(distanceKm(point, venue)) : null}
                onPress={() => onOpenVenue(venue)}
              />
              <View style={styles.who}>
                <Avatar username={first.username} size={18} />
                <Text style={styles.whoText} numberOfLines={1}>
                  {place.people.length > 1 ? `${who} +${place.people.length - 1}` : who} · {timeAgo(place.at, new Date())}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  section: { gap: 10, marginTop: 6 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  row: { gap: 12, paddingRight: 16 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  whoText: { flex: 1, fontSize: 12, color: colors.textMuted },
}));
