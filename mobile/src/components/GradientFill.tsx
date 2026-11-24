import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { isDarkScheme } from '../theme';

/** Mix two #rrggbb colours: 0 = a, 1 = b. */
function mix(a: string, b: string, t: number): string {
  const n = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [n(a), n(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * A diagonal two-colour gradient filling its parent (give the parent overflow: 'hidden' and a radius).
 * `scrim`: instead a dark veil, darker at the top and bottom edges, so labels on a photo stay readable.
 */
export function GradientFill({ colors: [darkFrom, to], scrim = false }: { colors: [string, string]; scrim?: boolean }) {
  // The deep start colour suits the dark theme; on the light (cream) theme it moves halfway to the bright end
  const from = isDarkScheme() || !/^#[0-9a-f]{6}$/i.test(darkFrom) ? darkFrom : mix(darkFrom, to, 0.5);
  // Each gradient needs its own id: two on one page must not share a definition
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    // width/height 100%: on the web the drawing otherwise stays square (a tall page was half black)
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" pointerEvents="none">
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
