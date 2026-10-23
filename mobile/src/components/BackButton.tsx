import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, themed } from '../theme';

export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.button} hitSlop={8} accessibilityLabel="Geri">
      <Text style={styles.icon}>‹</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  icon: { fontSize: 30, lineHeight: 32, marginTop: -2, marginRight: 2, color: colors.text },
}));
