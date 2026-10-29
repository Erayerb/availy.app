import { StyleSheet, View } from 'react-native';
import { Text } from './Text';

import { useSettings } from '../context/SettingsContext';
import type { Crowd } from '../lib/crowd';
import { colors, themed } from '../theme';
import { InlineIcon } from './Icon';

type Props = { venue: { open_now: boolean; crowd?: Crowd }; size?: number };

/** v2 status dot: fresh check-in level, "no recent data", never checked in (✨) or closed. */
export function CrowdDot({ venue, size = 10 }: Props) {
  const { crowdLook } = useSettings();
  const { color, glyph } = crowdLook(venue);
  const dotSize = glyph ? Math.max(size, 16) : size;
  return (
    <View style={[styles.dot, { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color }]}>
      {glyph && <Text style={[styles.glyph, { fontSize: dotSize * 0.6, lineHeight: dotSize }]}>{glyph === '✨' ? <InlineIcon name="sparkles" /> : glyph}</Text>}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  dot: { alignItems: 'center', justifyContent: 'center' },
  glyph: { color: colors.white, fontWeight: '800', textAlign: 'center' },
}));
