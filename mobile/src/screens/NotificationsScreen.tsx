import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '../components/BackButton';
import { useNotifications } from '../context/NotificationsContext';
import { sentence, timeAgo } from '../lib/crowd';
import { confirmAction } from '../lib/confirm';
import { NOTIFICATION_ICONS, notificationText } from '../lib/social';
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

/** v2 🔔 list: friend requests, accepted requests and replies to my reviews (last 30 days); kept until deleted. */
export function NotificationsScreen({ signedIn, onBack, onRegister, onOpenVenue, onOpenFriends, onOpenFeed, onOpenRanking, onOpenSettings }: Props) {
  const { items, markSeen, reload, dismiss, clear } = useNotifications();

  // Opening the list reads everything in it
  useEffect(() => {
    reload();
    markSeen();
  }, [reload, markSeen]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
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
                  : (n.kind === 'reply' || n.kind === 'reward' || n.kind === 'loyalty') && n.venue_id
                    ? onOpenVenue({ id: n.venue_id })
                    : onOpenFriends()
              }
              style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && styles.pressed]}
            >
              <Text style={styles.icon}>{NOTIFICATION_ICONS[n.kind]}</Text>
              <View style={styles.flex}>
                <Text style={styles.text}>{notificationText(n)}</Text>
                <Text style={styles.muted}>{sentence(timeAgo(n.at, new Date()))}</Text>
              </View>
              <Pressable onPress={() => dismiss(n.key)} hitSlop={10} style={styles.delete} accessibilityLabel="Bildirimi sil">
                <Text style={styles.deleteText}>🗑</Text>
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
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 48, gap: 14 },
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
  icon: { fontSize: 22 },
  flex: { flex: 1, gap: 2 },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  delete: { padding: 6 },
  deleteText: { fontSize: 18, color: colors.textMuted },
  clear: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.cream },
  clearText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  link: { color: colors.primary, fontWeight: '600', textAlign: 'center' },
  primary: { paddingVertical: 13, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontWeight: '700' },
}));
