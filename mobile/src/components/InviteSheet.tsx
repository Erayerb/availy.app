import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Pressable } from './Pressable';

import { inviteMessage } from '../lib/friends';
import { shareText } from '../lib/shareVenue';
import { colors, themed } from '../theme';
import { InlineIcon } from './Icon';

type Props = {
  username: string;
  // "Rehberden bul": Sosyal > Arkadaşlar, where the contacts are matched
  onFindContacts: () => void;
  // Next step ("Devam" / "Şimdilik geç")
  onDone: () => void;
};

/** Right after sign-up: invite friends (both become friends when they sign up through the link). */
export function InviteSheet({ username, onFindContacts, onDone }: Props) {
  const [note, setNote] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Arkadaşlarını davet et</Text>
        <Text style={styles.art}><InlineIcon name="user-plus" /><InlineIcon name="heart-handshake" /></Text>
        <Text style={styles.text}>
          availy arkadaşlarla daha eğlenceli: nerede olduklarını, nereyi sevdiklerini görürsün. Bağlantınla kayıt olan
          arkadaşın otomatik eklenir, sen de 50 puan kazanırsın.
        </Text>
        <Pressable
          style={styles.primary}
          onPress={async () => {
            setNote(await shareText(inviteMessage(username)));
            setShared(true);
          }}
        >
          <Text style={styles.primaryText}>Davet bağlantısını paylaş</Text>
        </Pressable>
        {Platform.OS !== 'web' && (
          <Pressable style={styles.secondary} onPress={onFindContacts}>
            <Text style={styles.secondaryText}>Rehberimdekileri bul</Text>
          </Pressable>
        )}
        {note && <Text style={styles.muted}>{note}</Text>}
        <Pressable onPress={onDone} hitSlop={10}>
          <Text style={styles.skip}>{shared ? 'Devam' : 'Şimdilik geç'}</Text>
        </Pressable>
        <Text style={styles.muted}>Sonra da Sosyal › Arkadaşlar'dan davet edebilirsin.</Text>
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.backdrop, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 44,
    gap: 14,
    alignItems: 'center',
  },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 14 },
  art: { fontSize: 56 },
  text: { fontSize: 16, lineHeight: 23, color: colors.text, textAlign: 'center' },
  muted: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  primary: { alignSelf: 'stretch', paddingVertical: 15, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  secondary: { alignSelf: 'stretch', paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center' },
  secondaryText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  skip: { color: colors.textMuted, fontSize: 15, fontWeight: '700' },
}));
