import { useEffect } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { useOnPageFocus } from '../context/PageContext';
import { Text } from '../components/Text';
import { Pressable } from '../components/Pressable';

import { BackButton } from '../components/BackButton';
import { usePullRefresh } from '../hooks/usePullRefresh';
import { useNotifications } from '../context/NotificationsContext';
import { sentence, timeAgo } from '../lib/crowd';
import { confirmAction } from '../lib/confirm';
import { notificationText, type AppNotification } from '../lib/social';
import { GradientFill } from '../components/GradientFill';
import { Icon, type IconName } from '../components/Icon';
import { colors, themed } from '../theme';

type Props = {
  signedIn: boolean;
  onBack: () => void;
  onRegister: () => void;
  onOpenVenue: (venue: { id: number }) => void;
  onOpenFriends: () => void; // Sosyal > Arkadaşlar, to accept a request
  onOpenFeed: () => void; // Sosyal > Akış: likes and comments under my check-in
  onOpenRanking: () => void; // Sosyal > Sıralama: a group invitation
  onOpenSettings: () => void;
};

const ICONS: Record<AppNotification['kind'], IconName> = {
  friend_request: 'user-plus',
  friend_accepted: 'users',
  reply: 'message-dots',
  reward: 'gift',
  loyalty: 'star',
  checkin_like: 'heart',
  checkin_comment: 'message-circle',
  group_invite: 'users-group',
  dead_hour: 'moon',
  auto_campaign: 'speakerphone',
  come_here: 'map-pin',
};

// Each kind its own colour, so the list reads at a glance: people blue, rewards gold, likes red…
const TINTS: Record<AppNotification['kind'], [string, string]> = {
  friend_request: ['#13304F', '#2F6AA3'],
  friend_accepted: ['#13304F', '#2F6AA3'],
  group_invite: ['#13304F', '#2F6AA3'],
  reply: ['#2B2350', '#7B5EA7'],
  checkin_comment: ['#2B2350', '#7B5EA7'],
  reward: ['#5A3A12', '#C9962B'],
  loyalty: ['#5A3A12', '#C9962B'],
  checkin_like: ['#7A2E1F', '#C8102E'],
  dead_hour: ['#3A3F47', '#6B7280'],
  auto_campaign: ['#7A2E1F', '#D9480F'],
  come_here: ['#123A2A', '#2E9E4F'],
};

/** v2 🔔 list: friend requests, accepted requests and replies to my reviews (last 30 days); kept until deleted. */
export function NotificationsScreen({ signedIn, onBack, onRegister, onOpenVenue, onOpenFriends, onOpenFeed, onOpenRanking, onOpenSettings }: Props) {
  const { items, markSeen, reload, dismiss, clear } = useNotifications();
  const pull = usePullRefresh(reload);
  useOnPageFocus(() => {
    reload();
    markSeen();
  });

  // Opening the list reads everything in it
  useEffect(() => {
    reload();
    markSeen();
  }, [reload, markSeen]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl {...pull} tintColor={colors.primary} />}>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={[styles.title, styles.flex]}>Bildirimler</Text>
        {signedIn && items.length > 0 && (
          <Pressable
            style={styles.clear}
            hitSlop={8}
            onPress={() => confirmAction('Tüm bildirimler silinsin mi?', 'Listedeki bildirimlerin hepsi silinir.', 'Temizle', clear)}
          >
            <Text style={styles.clearText}>Temizle</Text>
          </Pressable>
        )}
      </View>

      {!signedIn ? (
        <>
          <Text style={styles.muted}>Arkadaşlık istekleri ve yorumlarına gelen yanıtlar için kayıt ol.</Text>
          <Pressable style={styles.primary} onPress={onRegister}>
            <Text style={styles.primaryText}>Kayıt ol</Text>
          </Pressable>
        </>
      ) : items.length === 0 ? (
        <Text style={styles.muted}>Henüz bildirimin yok. Arkadaşlık istekleri ve yorumlarına gelen yanıtlar burada görünür.</Text>
      ) : (
        <View style={styles.card}>
          {items.map((n, i) => (
            <Pressable
              key={n.key}
              onPress={() =>
                n.kind === 'checkin_like' || n.kind === 'checkin_comment'
                  ? onOpenFeed()
                  : n.kind === 'group_invite'
                    ? onOpenRanking()
                  : (n.kind === 'reply' || n.kind === 'reward' || n.kind === 'loyalty' || n.kind === 'come_here') && n.venue_id
                    ? onOpenVenue({ id: n.venue_id })
                    : onOpenFriends()
              }
              style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && styles.pressed]}
            >
              <View style={styles.iconBox}>
                <GradientFill colors={TINTS[n.kind] ?? TINTS.dead_hour} />
                <Icon name={ICONS[n.kind]} size={19} color="#fff" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.text}>{notificationText(n)}</Text>
                <Text style={styles.muted}>{sentence(timeAgo(n.at, new Date()))}</Text>
              </View>
              <Pressable onPress={() => dismiss(n.key)} hitSlop={10} style={styles.delete} accessibilityLabel="Bildirimi sil">
                <Icon name="trash" size={20} color={colors.textMuted} />
              </Pressable>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable onPress={onOpenSettings}>
        <Text style={styles.link}>Bildirim ayarları ›</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: TAB_BAR_SPACE, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  card: {
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  pressed: { opacity: 0.7 },
  iconBox: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  delete: { padding: 6 },
  clear: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.cream },
  clearText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  link: { color: colors.primary, fontWeight: '600', textAlign: 'center' },
  primary: { paddingVertical: 13, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontWeight: '700' },
}));
