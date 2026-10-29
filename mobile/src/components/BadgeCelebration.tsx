import { Modal, StyleSheet, View } from 'react-native';

import { useBadgeCelebration } from '../lib/badgeEvents';
import { badgeIcon } from './BadgeGrid';
import { Celebration } from './Celebration';
import { haptics } from '../lib/haptics';
import { colors, themed } from '../theme';
import { InlineIcon } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

/** "Yeni rozet!": pops up wherever the user is when a badge is earned (with its points). */
export function BadgeCelebration() {
  const [badges, close] = useBadgeCelebration();
  const total = badges.reduce((sum, b) => sum + b.points, 0);
  if (badges.length) haptics.success();
  return (
    <Modal visible={badges.length > 0} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.box} onPress={() => {}}>
          <Celebration icon={badgeIcon(badges[0]?.id)} first={badges[0]?.id === 'explorer'} />
          <Text style={styles.title}>{badges.length > 1 ? `${badges.length} yeni rozet!` : 'Yeni rozet!'}</Text>
          {badges.map((b) => (
            <Text key={b.id} style={styles.line}>
              <InlineIcon name={badgeIcon(b.id)} color={colors.primary} /> {b.name} · +{b.points} puan
            </Text>
          ))}
          {badges.length > 1 && <Text style={styles.total}>Toplam +{total} puan</Text>}
          <Pressable style={styles.button} onPress={close}>
            <Text style={styles.buttonText}>Harika</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = themed(() => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'center', padding: 28 },
  box: { alignItems: 'center', gap: 8, padding: 22, borderRadius: 22, backgroundColor: colors.surface, maxWidth: 380, width: '100%', alignSelf: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  line: { fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' },
  total: { fontSize: 14, color: colors.textMuted },
  button: { marginTop: 8, alignSelf: 'stretch', paddingVertical: 13, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center' },
  buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
}));
