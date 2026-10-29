import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from './Text';

import { timeAgo } from '../lib/crowd';
import { friendsApi } from '../lib/friends';
import { colors, themed } from '../theme';
import { InlineIcon } from './Icon';

type Props = {
  venueId: number;
  token: string | null; // registered customers only; nothing is shown without one
  onOpenUser?: (username: string) => void;
  reloadKey?: unknown; // a new value loads again (e.g. after a refresh)
};

/** "👑 Buranın müdavimi @ayse · 30 günde 5 check-in" (me, a friend, or someone who shows it to everyone). */
export function VenueRegular({ venueId, token, onOpenUser, reloadKey }: Props) {
  const [regular, setRegular] = useState<{ username: string; visits: number; me: boolean; friend: boolean } | null>(null);

  useEffect(() => {
    if (!token) return setRegular(null);
    friendsApi.regular(token, venueId).then(setRegular).catch(() => {});
  }, [token, venueId, reloadKey]);

  if (!regular) return null;
  return (
    <Text style={styles.line}>
      <InlineIcon name="crown" />{' '}
      {regular.me ? (
        'Buranın müdavimi sensin'
      ) : (
        <>
          Buranın müdavimi{' '}
          <Text style={styles.name} onPress={onOpenUser ? () => onOpenUser(regular.username) : undefined}>
            @{regular.username}
          </Text>
          {regular.friend ? ' (arkadaşın)' : ''}
        </>
      )}
      <Text style={styles.muted}> · 30 günde {regular.visits} check-in</Text>
    </Text>
  );
}

/** "👥 @ayse ve @can burada · 20 dk önce check-in": friends who checked in here in the last hour. */
export function FriendsHere({ venueId, token, onOpenUser, reloadKey }: Props) {
  const [friends, setFriends] = useState<{ username: string; at: string }[]>([]);

  useEffect(() => {
    if (!token) return setFriends([]);
    friendsApi.here(token, venueId).then(setFriends).catch(() => {});
  }, [token, venueId, reloadKey]);

  if (friends.length === 0) return null;
  return (
    <Text style={styles.line}>
      <InlineIcon name="users" />{' '}
      {friends.map((f, i) => (
        <Text key={f.username}>
          {i > 0 ? (i === friends.length - 1 ? ' ve ' : ', ') : ''}
          <Text style={styles.name} onPress={onOpenUser ? () => onOpenUser(f.username) : undefined}>
            @{f.username}
          </Text>
        </Text>
      ))}{' '}
      burada · {timeAgo(friends[0].at, new Date())} check-in
    </Text>
  );
}

const styles = themed(() => StyleSheet.create({
  line: { fontSize: 14, color: colors.text, fontWeight: '600' },
  name: { color: colors.primary, fontWeight: '700' },
  muted: { color: colors.textMuted, fontWeight: '400' },
}));
