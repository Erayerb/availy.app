import { StyleSheet, View } from 'react-native';

import { colors, themed } from '../theme';
import { Icon, type IconName } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

type Props = {
  icon: IconName;
  title: string;
  text: string;
  action?: { label: string; onPress: () => void };
};

/** An empty list as an invitation: what goes here, and the one step that fills it. */
export function EmptyState({ icon, title, text, action }: Props) {
  return (
    <View style={styles.box}>
      <View style={styles.iconRing}>
        <Icon name={icon} size={26} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
      {action && (
        <Pressable onPress={action.onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  box: { alignItems: 'center', gap: 8, paddingVertical: 28, paddingHorizontal: 24, marginTop: 8, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  iconRing: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },
  text: { fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: 'center' },
  button: { marginTop: 8, paddingVertical: 11, paddingHorizontal: 20, borderRadius: 12, backgroundColor: colors.primary },
  pressed: { opacity: 0.8 },
  buttonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
}));
