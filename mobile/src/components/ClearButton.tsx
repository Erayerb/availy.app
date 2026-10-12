import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

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

const styles = StyleSheet.create({
  button: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: colors.primary },
  disabled: { backgroundColor: colors.disabled },
  text: { color: colors.onPrimary, fontSize: 12, fontWeight: '600' },
});
