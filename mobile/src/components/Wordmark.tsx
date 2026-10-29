import { StyleSheet } from 'react-native';
import { Text } from './Text';

import { colors, themed } from '../theme';

export const WORDMARK_FONT = 'Tinos_400Regular';

type Props = {
  size?: number;
  color?: string;
};

/** "availy" in Tinos (a serif), in the theme's accent color; plain letters, no swash under the y. */
export function Wordmark({ size = 40, color = colors.primary }: Props) {
  return (
    <Text style={[styles.text, { fontSize: size, lineHeight: Math.round(size * 1.2), color }]} accessibilityLabel="availy">
      availy
    </Text>
  );
}

const styles = themed(() => StyleSheet.create({
  // Placed by the parent: left in the headers, centered on the welcome and loading screens
  text: { fontFamily: WORDMARK_FONT, includeFontPadding: false },
}));
