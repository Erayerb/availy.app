import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { useFriendsHere } from '../context/FriendsHereContext';
import { timeAgo } from '../lib/crowd';
import { directionsUrl } from '../lib/location';
import { colors, themed } from '../theme';
import { Avatar } from './Avatar';
import { BottomSheet } from './BottomSheet';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

const SHOWN = 2;

/** On a venue card's bottom right: the friends there now (checked in within the hour), as overlapping photos.
 * A tap lists them: each opens their profile, and "Yanına git" gives directions to the venue. */
export function FriendsHereBadge({ venue }: { venue: { id: number; name: string; lat: number; lon: number } }) {
  const { here, openUser } = useFriendsHere();
  const [open, setOpen] = useState(false);
  const friends = here(venue.id);
  if (friends.length === 0) return null;
  const more = friends.length - SHOWN;
  const names = friends.map((f) => `@${f.username}`).join(', ');

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={6} style={styles.stack} accessibilityRole="button" accessibilityLabel={`Şu an burada: ${names}`}>
        {friends.slice(0, SHOWN).map((f, i) => (
          <View key={f.id} style={[styles.ring, i > 0 && styles.overlap]}>
            <Avatar username={f.username} size={24} />
          </View>
        ))}
        {more > 0 && (
          <View style={[styles.ring, styles.overlap, styles.more]}>
            <Text style={styles.moreText}>+{more}</Text>
          </View>
        )}
      </Pressable>
      {open && (
        <BottomSheet visible title="Şu an burada olan arkadaşların" onClose={() => setOpen(false)}>
          <Text style={styles.muted}>{venue.name}</Text>
          {friends.map((f) => (
            <Pressable
              key={f.id}
              style={styles.row}
              onPress={() => {
                setOpen(false);
                openUser(f.username);
              }}
              accessibilityRole="button"
            >
              <Avatar username={f.username} size={40} />
              <View style={styles.flex}>
                <Text style={styles.name}>@{f.username}</Text>
                {f.last_checkin && <Text style={styles.muted}>{timeAgo(f.last_checkin.at, new Date())} check-in yaptı</Text>}
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
          <Pressable style={styles.go} onPress={() => Linking.openURL(directionsUrl(Platform.OS, venue.lat, venue.lon)).catch(() => {})} accessibilityRole="button">
            <Icon name="map-pin" size={18} color={colors.onPrimary} />
            <Text style={styles.goText}>Yanına git</Text>
          </Pressable>
        </BottomSheet>
      )}
    </>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    stack: { flexDirection: 'row', alignItems: 'center' },
    ring: { borderRadius: 14, borderWidth: 2, borderColor: colors.background, overflow: 'hidden' },
    overlap: { marginLeft: -9 },
    more: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
    moreText: { fontSize: 11, fontWeight: '800', color: colors.text },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
    flex: { flex: 1 },
    name: { fontSize: 15, fontWeight: '700', color: colors.text },
    muted: { fontSize: 13, color: colors.textMuted },
    chevron: { fontSize: 20, color: colors.textMuted },
    go: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.primary },
    goText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  }),
);
