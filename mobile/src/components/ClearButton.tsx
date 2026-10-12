import { Pressable, StyleSheet, Text } from 'react-native';

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
  button: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: '#1f2937' },
  disabled: { backgroundColor: '#d1d5db' },
  text: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
