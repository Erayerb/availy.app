import { Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import filledPaths from '../lib/tablerFilledPaths.json';
import glyphs from '../lib/tablerGlyphs.json';
import outlinePaths from '../lib/tablerPaths.json';

/**
 * One icon set for the whole app: Tabler (MIT, tabler.io/icons), outline, plus filled versions for a
 * few "on" states (♡ → heart filled). The same on every phone, unlike emoji. Only the icons the app uses
 * are in: after using a new name, run `python3 scripts/build-icons.py` (tsc reports a name not in yet).
 */
// The font's name (scripts/build-icons.py), for icons inside a line of text; a new name makes phones load it afresh
export const ICON_FONT = 'availy-icons';

export type IconName = keyof typeof glyphs;

const OUTLINE: Record<string, string> = outlinePaths;
const FILLED: Record<string, string> = filledPaths;

/** A stand-alone icon, drawn: exactly in the middle of its box on every phone. */
export function Icon({ name, size = 22, color, filled = false }: { name: IconName; size?: number; color: string; filled?: boolean }) {
  const solid = filled && FILLED[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {solid ? (
        <Path d={FILLED[name]} fill={color} />
      ) : (
        <Path d={OUTLINE[name]} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </Svg>
  );
}

/** The glyph as a character, e.g. for a web map marker's HTML (font-family: tabler-icons). */
export const iconChar = (name: IconName) => String.fromCodePoint(glyphs[name]);

/**
 * An icon inside a line of text ("<InlineIcon name="map-pin" /> Check-in yap"): it takes the line's
 * size and color, and wraps with it.
 */
export function InlineIcon({ name, color }: { name: IconName; color?: string }) {
  return <Text style={{ fontFamily: ICON_FONT, fontWeight: 'normal', color }}>{iconChar(name)}</Text>;
}
