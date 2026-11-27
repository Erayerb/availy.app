import type { NewBadge } from '../lib/badgeEvents';
import { Modal, StyleSheet, View } from 'react-native';

import { useBadgeCelebration } from '../lib/badgeEvents';
import { Celebration } from './Celebration';
import { Icon } from './Icon';
import { badgeIcon } from '../lib/badgeIcons';
import { haptics } from '../lib/haptics';
import { colors, themed } from '../theme';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { useHoldTips } from '../lib/tips';

/** "Yeni rozet!": pops up wherever the user is when a badge is earned (with its points). */
export function BadgeCelebration() {
  const [badges, close] = useBadgeCelebration();
  useHoldTips(badges.length > 0);
  const total = badges.reduce((sum, b) => sum + b.points, 0);
  if (badges.length) haptics.success();
  return (
    <Modal visible={badges.length > 0} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.box} onPress={() => {}}>
          {badges[0] && <Celebration icon={badgeIcon(badges[0].id)} medal first={badges[0].id === 'explorer'} />}
          <Text style={styles.title}>{title(badges)}</Text>
          {badges.map((b) =>
            b.kind === 'first' ? (
              <Text key={b.id} style={styles.total}>
                {b.points > 0 ? `+${b.points} puan kazandın. ` : ''}Puanla seviye atlarsın, haftalık sıralamaya girersin; mekanların
                availo ödüllerini ve özel kuponlarını alırsın.
              </Text>
            ) : // A streak alone is the title; with badges it is one of the lines
            b.kind === 'streak' && badges.length === 1 ? (
              <Text key={b.id} style={styles.total}>Her hafta en az bir check-in yap, seri sürsün.</Text>
            ) : (
              <View key={b.id} style={styles.lineRow}>
                <Icon name={badgeIcon(b.id)} size={16} color={colors.gold} />
                <Text style={styles.line}>
                  {b.name}
                  {b.points > 0 ? ` · +${b.points} puan` : ''}
                </Text>
              </View>
            ),
          )}
          {badges.filter((b) => b.points > 0 && b.kind !== 'first').length > 1 && <Text style={styles.total}>Toplam +{total} puan</Text>}
          <Pressable style={styles.button} onPress={close}>
            <Text style={styles.buttonText}>Harika</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function title(badges: NewBadge[]): string {
  if (badges[0]?.kind === 'first') return "İlk check-in'in!";
  const real = badges.filter((b) => b.kind !== 'streak');
  if (!real.length) return badges[0]?.name ?? '';
  return real.length > 1 ? `${real.length} yeni rozet!` : 'Yeni rozet!';
}

const styles = themed(() => StyleSheet.create({
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'center', padding: 28 },
  box: { alignItems: 'center', gap: 8, padding: 22, borderRadius: 22, backgroundColor: colors.surface, maxWidth: 380, width: '100%', alignSelf: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  line: { fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' },
  total: { fontSize: 14, color: colors.textMuted },
  button: { marginTop: 8, alignSelf: 'stretch', paddingVertical: 13, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center' },
  buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
}));
