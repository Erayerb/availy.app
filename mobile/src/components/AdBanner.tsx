import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, themed } from '../theme';

/** Free plan: place of the location-based ad (demo); tapping opens the Premium page. */
export function AdBanner({ onPremium }: { onPremium: () => void }) {
  return (
    <Pressable style={styles.banner} onPress={onPremium}>
      <Text style={styles.label}>REKLAM</Text>
      <Text style={styles.text}>
        Ücretsiz sürümde burada yakınındaki mekanların reklamları görünür. Reklamsız kullanım için Premium ›
      </Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  banner: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 4,
  },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: colors.placeholder },
  text: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
}));
