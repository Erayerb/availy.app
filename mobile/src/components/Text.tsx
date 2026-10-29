import { createContext, useContext } from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';

/**
 * The app's fonts: Figtree for text, Tinos for headings (20 pt and larger: screen titles, venue names,
 * big numbers) like the "availy" wordmark. React Native has no app-wide font, so every Text / TextInput
 * comes from here; each weight is its own font file, so the style's fontWeight picks the file. A style
 * that names its own fontFamily (the wordmark, icons) is left alone.
 */
export const FIGTREE = {
  300: 'Figtree_300Light',
  400: 'Figtree_400Regular',
  500: 'Figtree_500Medium',
  600: 'Figtree_600SemiBold',
  700: 'Figtree_700Bold',
  800: 'Figtree_800ExtraBold',
  900: 'Figtree_900Black',
} as const;

type Weight = keyof typeof FIGTREE;

// Tinos has a regular and a bold file
export const TINOS = { regular: 'Tinos_400Regular', bold: 'Tinos_700Bold' } as const;
const HEADING_SIZE = 20;

function weightOf(fontWeight: TextStyle['fontWeight']): Weight {
  if (fontWeight === 'bold') return 700;
  const n = Number(fontWeight);
  if (!fontWeight || fontWeight === 'normal' || Number.isNaN(n)) return 400;
  return (Math.min(900, Math.max(300, Math.round(n / 100) * 100)) as Weight);
}

/** The style with the font file for its size and weight (fontWeight then stays normal, the file is the weight). */
export function withFont(style: StyleProp<TextStyle>, inherit = false): StyleProp<TextStyle> {
  const flat = StyleSheet.flatten(style) ?? {};
  if (flat.fontFamily) return style;
  // Nested text without its own weight keeps its parent's font (e.g. a plain word inside a bold line)
  if (inherit && flat.fontWeight === undefined) return style;
  const weight = weightOf(flat.fontWeight);
  const family = (flat.fontSize ?? 0) >= HEADING_SIZE ? (weight >= 600 ? TINOS.bold : TINOS.regular) : FIGTREE[weight];
  return [style, { fontFamily: family, fontWeight: 'normal' }];
}

const InsideText = createContext(false);

export function Text(props: TextProps) {
  const nested = useContext(InsideText);
  return (
    <InsideText.Provider value>
      <RNText {...props} style={withFont(props.style, nested)} />
    </InsideText.Provider>
  );
}

export function TextInput(props: TextInputProps) {
  return <RNTextInput {...props} style={withFont(props.style)} />;
}
