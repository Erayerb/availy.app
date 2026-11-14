import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * A diagonal two-colour gradient filling its parent (give the parent overflow: 'hidden' and a radius).
 * `scrim`: instead a dark veil, darker at the top and bottom edges, so labels on a photo stay readable.
 */
export function GradientFill({ colors: [from, to], scrim = false }: { colors: [string, string]; scrim?: boolean }) {
  // Each gradient needs its own id: two on one page must not share a definition
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100" pointerEvents="none">
      <Defs>
        {scrim ? (
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000" stopOpacity={0.35} />
            <Stop offset="0.35" stopColor="#000" stopOpacity={0.05} />
            <Stop offset="0.65" stopColor="#000" stopOpacity={0.05} />
            <Stop offset="1" stopColor="#000" stopOpacity={0.4} />
          </LinearGradient>
        ) : (
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        )}
      </Defs>
      <Rect width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  );
}
