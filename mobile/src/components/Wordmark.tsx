import { StyleSheet, View } from 'react-native';

import { colors, themed } from '../theme';
import { Logo } from './Logo';
import { Text } from './Text';

type Props = {
  size?: number;
  mark?: boolean; // the arch and dot in front of the name
};

/** The name as in the logo: "Availo" in Figtree, in the text color of the theme. */
export function Wordmark({ size = 40, mark = true }: Props) {
  return (
    <View style={styles.row} accessibilityRole="header">
      {mark && <Logo size={size * 1.05} />}
      <Text style={[styles.text, { fontSize: size, lineHeight: Math.round(size * 1.2) }]}>Availo</Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  // Placed by the parent: left in the headers, centered on the welcome and loading screens
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontFamily: 'Figtree_600SemiBold', color: colors.text, includeFontPadding: false, letterSpacing: -0.5 },
}));
