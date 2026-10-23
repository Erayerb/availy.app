import { StyleSheet, Text, View } from 'react-native';

import { colors, themed } from '../theme';

/** App mark: a red "@" inside a red-outlined cream circle. */
export function Logo({ size = 96 }: { size?: number }) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, borderWidth: Math.max(2, size * 0.06) },
      ]}
    >
      <Text style={[styles.at, { fontSize: size * 0.58, lineHeight: size * 0.7 }]}>@</Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  circle: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  at: { color: colors.primary, fontWeight: '800', textAlign: 'center' },
}));
