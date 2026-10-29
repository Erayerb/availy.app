import { StyleSheet, View } from 'react-native';
import { Text } from './Text';

import { useSettings } from '../context/SettingsContext';
import { colors, themed } from '../theme';
import { InlineIcon } from './Icon';

type Props = { level: string; open?: boolean; size?: number };

/** Occupancy colour dot; in colour-blind mode it also carries a symbol. */
export function LevelDot({ level, open = true, size = 10 }: Props) {
  const { look } = useSettings();
  const { color, glyph } = look(level, open);
  const dotSize = glyph ? Math.max(size, 16) : size;
  return (
    <View style={[styles.dot, { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color }]}>
      {glyph && <Text style={[styles.glyph, { fontSize: dotSize * 0.65, lineHeight: dotSize }]}>{glyph === '✨' ? <InlineIcon name="sparkles" /> : glyph}</Text>}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  dot: { alignItems: 'center', justifyContent: 'center' },
  glyph: { color: colors.white, fontWeight: '800', textAlign: 'center' },
}));
