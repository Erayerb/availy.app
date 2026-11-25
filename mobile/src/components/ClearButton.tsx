import { StyleSheet } from 'react-native';
import { Text } from './Text';
import { Pressable } from './Pressable';
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
      <Text style={[styles.text, disabled && styles.disabledText]}>✕ Temizle</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  button: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: colors.primary },
  // Nothing to clear: a quiet outline, readable on every theme
  disabled: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border, paddingVertical: 4 },
  disabledText: { color: colors.textMuted },
  text: { color: colors.onPrimary, fontSize: 12, fontWeight: '600' },
  // Faded until switched on
}));
