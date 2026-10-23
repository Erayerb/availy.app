import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, themed } from '../theme';

type Props = {
  onPress: () => void;
  disabled: boolean;
};

/** "✕ Temizle" pill used wherever filters can be reset. */
export function ClearButton({ onPress, disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={[styles.button, disabled && styles.disabled]}
    >
      <Text style={styles.text}>✕ Temizle</Text>
    </Pressable>
  );
}

/** Same pill shape as "Temizle", used as an on/off switch (e.g. "Kapalıları gizle"). */
export function TogglePill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={[styles.button, !active && styles.off]}
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
    >
      <Text style={[styles.text, !active && styles.offText]}>
        {active ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  button: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: colors.primary },
  disabled: { backgroundColor: colors.disabled },
  text: { color: colors.onPrimary, fontSize: 12, fontWeight: '600' },
  // Faded until switched on
  off: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, paddingVertical: 4, opacity: 0.5 },
  offText: { color: colors.primary },
}));
