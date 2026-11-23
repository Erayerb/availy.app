import { StyleSheet, Text } from 'react-native';

import { colors, themed } from '../theme';

/** "availo+": Premium, beside the name on a profile (inside a line of text). */
export function PlusBadge() {
  return <Text style={styles.badge}>  availo+</Text>;
}

const styles = themed(() => StyleSheet.create({
  badge: { fontSize: 13, fontWeight: '800', color: colors.gold, letterSpacing: 0.3 },
}));
