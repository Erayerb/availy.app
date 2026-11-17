import { shareText } from '../lib/shareVenue';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useLocation } from '../context/LocationContext';
import { useOnPageFocus } from '../context/PageContext';
import { useVenuesByIds } from '../hooks/useVenuesByIds';
import type { Venue } from '../lib/api';
import { timeAgo } from '../lib/crowd';
import { friendsApi, inviteMessage, placesFromFriends, type Friend } from '../lib/friends';
import { distanceKm, formatDistance } from '../lib/geo';
import { colors, themed } from '../theme';
import { Avatar } from './Avatar';
import { Text } from './Text';
import { VenueTile } from './VenueTile';

const TILE = 150;
type Props = {
  token: string | null;
  onOpenVenue: (venue: Venue) => void;
  onAddFriends?: () => void; // nothing to show yet: "Arkadaş ekle"
  inviteName?: string | null; // my user name, for "Davet et"
};

/** Home: "Arkadaşlarının gittiği yerler", a row of cards; with no visits yet, ways to add friends. */
export function FriendsPlaces({ token, onOpenVenue, onAddFriends, inviteName = null }: Props) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const load = useCallback(() => {
    if (!token) return;
    friendsApi
      .list(token)
      .then((lists) => setFriends(lists.friends))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [token]);
  useEffect(load, [load]);
  useOnPageFocus(load);

  const places = useMemo(() => placesFromFriends(friends, new Date()), [friends]);
  const { venues } = useVenuesByIds(places.map((p) => p.venueId));
  const { point } = useLocation();
  const byId = new Map(venues.map((v) => [v.id, v]));
  const shown = places.filter((p) => byId.has(p.venueId));
  if (!token || !loaded) return null;
  const empty = shown.length === 0;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Arkadaşlarının gittiği yerler</Text>
      {empty ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {friends.length === 0 ? 'Arkadaşlarını ekle; gittikleri yerler burada görünür.' : 'Arkadaşların son 7 günde bir yere gitmedi. Daha çok arkadaş ekle.'}
          </Text>
          <View style={styles.emptyButtons}>
            {onAddFriends && (
              <Pressable style={[styles.button, styles.buttonPrimary]} onPress={onAddFriends}>
                <Icon name="user-plus" size={16} color={colors.onPrimary} />
                <Text style={styles.buttonPrimaryText}>Arkadaş ekle</Text>
              </Pressable>
            )}
            {inviteName && (
              <Pressable style={styles.button} onPress={async () => setNote(await shareText(inviteMessage(inviteName)))}>
                <Icon name="share-3" size={16} color={colors.text} />
                <Text style={styles.buttonText}>Davet et</Text>
              </Pressable>
            )}
          </View>
          {note && <Text style={styles.whoText}>{note}</Text>}
        </View>
      ) : (
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
      )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  section: { gap: 10, marginTop: 6 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  empty: { padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
  emptyText: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  emptyButtons: { flexDirection: 'row', gap: 8 },
  button: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.cream },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonText: { fontSize: 14, fontWeight: '700', color: colors.text },
  buttonPrimaryText: { fontSize: 14, fontWeight: '700', color: colors.onPrimary },
  row: { gap: 12, paddingRight: 16 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  whoText: { flex: 1, fontSize: 12, color: colors.textMuted },
}));
