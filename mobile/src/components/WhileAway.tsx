import { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { send } from '../lib/accountApi';
import { fetchVenuesByIds, type Venue } from '../lib/api';
import { KEYS, loadJson, saveJson } from '../lib/storage';
import { colors, themed } from '../theme';
import { Icon, InlineIcon } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

// Shown when the app comes back after this long
const AWAY_MS = 6 * 3_600_000;

type Away = {
  friend_checkins: number;
  friend_places: string[];
  notifications: number;
  quiet_favorites: { id: number; name: string }[];
};

/** Home: "Sen yokken" — what happened since the app was last open (friends' check-ins, new 🔔 items) and
 * favourites quiet right now. Only after a while away, and only when there is something to tell. */
export function WhileAway({ token, onOpenVenue, onOpenNotifications }: { token: string | null; onOpenVenue: (venue: Venue) => void; onOpenNotifications?: () => void }) {
  const [away, setAway] = useState<Away | null>(null);

  const check = useCallback(async () => {
    if (!token) return;
    const last = await loadJson<string>(KEYS.lastOpened);
    const now = new Date();
    await saveJson(KEYS.lastOpened, now.toISOString());
    if (!last || now.getTime() - new Date(last).getTime() < AWAY_MS) return;
    send<Away>('GET', `/v1/me/while-away?since=${encodeURIComponent(last)}`, undefined, token)
      .then((a) => setAway(a.friend_checkins || a.notifications || a.quiet_favorites.length ? a : null))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
      else saveJson(KEYS.lastOpened, new Date().toISOString());
    });
    return () => sub.remove();
  }, [check]);

  if (!away) return null;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Sen yokken</Text>
        <Pressable onPress={() => setAway(null)} hitSlop={10} accessibilityLabel="Kapat">
          <Icon name="x" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
      {away.friend_checkins > 0 && (
        <Text style={styles.text}>
          <InlineIcon name="users" /> Arkadaşların {away.friend_checkins} check-in yaptı
          {away.friend_places.length ? `: ${away.friend_places.join(', ')}` : ''}.
        </Text>
      )}
      {away.notifications > 0 && (
        <Pressable onPress={onOpenNotifications} disabled={!onOpenNotifications}>
          <Text style={styles.text}>
            <InlineIcon name="bell" /> {away.notifications} yeni bildirimin var.
          </Text>
        </Pressable>
      )}
      {away.quiet_favorites.map((v) => (
        <Pressable key={v.id} onPress={() => fetchVenuesByIds([v.id]).then(([venue]) => venue && onOpenVenue(venue)).catch(() => {})}>
          <Text style={styles.text}>
            <InlineIcon name="heart" /> Favorin <Text style={styles.bold}>{v.name}</Text> şu an sakin.
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  text: { fontSize: 14, color: colors.text, lineHeight: 20 },
  bold: { fontWeight: '700' },
}));
