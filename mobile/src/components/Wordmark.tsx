import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, themed } from '../theme';

export const WORDMARK_FONT = 'DancingScript_700Bold';

type Props = {
  size?: number;
  color?: string;
};

/**
 * "availy" in a handwritten script; the tail of the y sweeps back under the
 * whole word and ends below the first "a".
 */
export function Wordmark({ size = 40, color = colors.text }: Props) {
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const lineHeight = Math.round(size * 1.25);
  // Extra room below the text for the swash
  const swashDepth = size * 0.42;

  return (
    <View style={{ paddingBottom: swashDepth }}>
      <Text
        style={[styles.text, { fontSize: size, lineHeight, color }]}
        onLayout={(e) => setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        accessibilityLabel="availy"
      >
        availy
      </Text>
      {box && (
        <Svg
          style={StyleSheet.absoluteFill}
          width={box.width}
          height={box.height + swashDepth}
          pointerEvents="none"
        >
          <Path d={swashPath(box.width, box.height, size)} stroke={color} strokeWidth={size * 0.075} strokeLinecap="round" fill="none" />
        </Svg>
      )}
    </View>
  );
}

/** From the y's descender, down and left under the word, finishing with a small lift under the "a". */
function swashPath(width: number, height: number, size: number): string {
  const start = { x: width * 0.885, y: height * 0.86 };
  const low = height + size * 0.28;
  const end = { x: width * 0.06, y: height + size * 0.05 };
  return [
    `M ${start.x} ${start.y}`,
    `C ${width * 0.84} ${low} ${width * 0.55} ${low + size * 0.06} ${width * 0.3} ${low - size * 0.02}`,
    `S ${width * 0.02} ${height + size * 0.22} ${end.x} ${end.y}`,
  ].join(' ');
}

const styles = themed(() => StyleSheet.create({
  // flex-start: the measured width is the word itself, even inside a stretched column
  text: { fontFamily: WORDMARK_FONT, includeFontPadding: false, alignSelf: 'flex-start' },
}));
