import createIconSet from '@expo/vector-icons/createIconSet';
import { Text } from 'react-native';

import filledGlyphs from '../lib/tablerFilledGlyphs.json';
import glyphs from '../lib/tablerGlyphs.json';

/**
 * One icon set for the whole app: Tabler (MIT, tabler.io/icons), outline, plus filled versions for a
 * few "on" states (♡ → heart filled). The same on every phone, unlike emoji. The fonts hold only the
 * icons the app uses: after using a new name, run `python3 scripts/build-icons.py` (tsc reports a name
 * that is not in the font yet).
 */
// The fonts' names (scripts/build-icons.py); a new name makes phones load the font afresh
export const ICON_FONT = 'availy-icons';
export const ICON_FONT_FILLED = 'availy-icons-filled';

const Outline = createIconSet(glyphs, ICON_FONT, require('../../assets/fonts/tabler-icons.ttf'));
const Filled = createIconSet(filledGlyphs, ICON_FONT_FILLED, require('../../assets/fonts/tabler-icons-filled.ttf'));

export type IconName = keyof typeof glyphs;

const hasFilled = (name: IconName): name is IconName & keyof typeof filledGlyphs => name in filledGlyphs;

export function Icon({ name, size = 22, color, filled = false }: { name: IconName; size?: number; color: string; filled?: boolean }) {
  // A line exactly as tall as the icon, so it sits in the middle of round buttons and dots
  const style = { lineHeight: size, includeFontPadding: false, textAlign: 'center' as const };
  return filled && hasFilled(name) ? (
    <Filled name={name} size={size} color={color} style={style} />
  ) : (
    <Outline name={name} size={size} color={color} style={style} />
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
