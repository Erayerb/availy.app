import { StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { colors, themed } from '../theme';

export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.button} hitSlop={8} accessibilityLabel="Geri">
      <Icon name="chevron-back" size={24} color={colors.text} />
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
}));
