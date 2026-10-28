/**
 * App palette: red + cream (light), warm dark brown (dark) and, on trial, petrol (deep teal) and graphite. Occupancy colors
 * (green/yellow/red) live in lib/occupancy.ts.
 *
 * `colors` and `themed(...)` styles always read the current scheme, so screens keep
 * writing `colors.text` / `styles.page`; ThemeGate (App.tsx) sets the scheme before
 * the screens render and re-renders them when it changes.
 */
export const lightColors = {
  primary: '#C8102E', // brand red: buttons, active chips, logo, favorites
  primaryPressed: '#A10D25',
  onPrimary: '#FFF8EE', // text on red
  background: '#FBF4E8', // cream page background
  surface: '#FFFCF6', // cards, buttons and panels on top of the map
  cream: '#F3E7D3', // inputs, inactive chips
  border: '#E6D6BE',
  text: '#2B1D16', // dark brown
  textMuted: '#7D6A5A',
  placeholder: '#A8968A',
  disabled: '#D9CBB6',
  danger: '#B42318',
  success: '#2E7D32',
  successBg: '#DCF0DC', // "İzin verildi" badge
  discovery: '#7B5EA7', // ✨ "keşfetti"
  gold: '#B7791F', // leaderboard prize line
  closedShade: 'rgba(255,255,255,0.45)', // over the photo of a closed venue
  white: '#FFFFFF',
  shadow: '#000000',
  backdrop: 'rgba(43,29,22,0.4)',
};

export type Palette = typeof lightColors;

export const darkColors: Palette = {
  primary: '#E0263F', // a little brighter, so it does not look dull on dark brown
  primaryPressed: '#C21F36',
  onPrimary: '#FFF8EE',
  background: '#17110E', // warm dark brown, not pure black
  surface: '#231B17',
  cream: '#2E241F',
  border: '#3A2E27',
  text: '#F5EBDD', // creamy white
  textMuted: '#B3A292',
  placeholder: '#7E6E62',
  disabled: '#4A3C33',
  danger: '#F05545',
  success: '#5CC26A',
  successBg: '#1F3A24',
  discovery: '#B79CE0',
  gold: '#E3A84A',
  closedShade: 'rgba(23,17,14,0.55)',
  white: '#FFFFFF',
  shadow: '#000000',
  backdrop: 'rgba(0,0,0,0.6)',
};

// On trial (Görünüm > Petrol): deep teal with a coral accent
export const petrolColors: Palette = {
  primary: '#FF7A59', // coral: buttons, active chips, logo
  primaryPressed: '#E8623F',
  onPrimary: '#3A1306', // dark text reads better on coral than white
  background: '#061A1E', // night petrol, almost black
  surface: '#0B252A',
  cream: '#113037', // inputs, inactive chips
  border: '#173B42',
  text: '#E6F4F3',
  textMuted: '#8FB3B0',
  placeholder: '#5C8380',
  disabled: '#1C444B',
  danger: '#FF6B6B',
  success: '#4FD18B',
  successBg: '#123A2C',
  discovery: '#C3B1FF',
  gold: '#F2C14E',
  closedShade: 'rgba(6,26,30,0.55)',
  white: '#FFFFFF',
  shadow: '#000000',
  backdrop: 'rgba(3,10,11,0.65)',
};

// On trial (Görünüm > Grafit): colorless dark gray, one vivid accent (indigo), so the occupancy colors stand out
export const graphiteColors: Palette = {
  primary: '#8B7CFF',
  primaryPressed: '#7262E8',
  onPrimary: '#120E33', // dark text: white on this indigo is too faint
  background: '#111113',
  surface: '#1B1B1E',
  cream: '#27272B', // inputs, inactive chips
  border: '#323237',
  text: '#F2F2F4',
  textMuted: '#A1A1AA',
  placeholder: '#71717A',
  disabled: '#3A3A40',
  danger: '#F87171',
  success: '#4ADE80',
  successBg: '#14301F',
  discovery: '#C9B8FF',
  gold: '#FBBF24',
  closedShade: 'rgba(17,17,19,0.55)',
  white: '#FFFFFF',
  shadow: '#000000',
  backdrop: 'rgba(0,0,0,0.65)',
};

export type Scheme = 'light' | 'dark' | 'petrol' | 'graphite';

const PALETTES: Record<Scheme, Palette> = { light: lightColors, dark: darkColors, petrol: petrolColors, graphite: graphiteColors };

let current: Scheme = 'light';

export const getScheme = (): Scheme => current;

/** Every scheme but light has a dark page: light status bar, dark map, brighter occupancy colors. */
export const isDarkScheme = (scheme: Scheme = current): boolean => scheme !== 'light';

/** Called by ThemeGate while rendering, before any screen reads a color. */
export function setScheme(scheme: Scheme): void {
  current = scheme;
}

/** The palette of the current scheme; `colors.text` works anywhere, as before. */
export const colors: Palette = new Proxy({} as Palette, {
  get: (_, key) => PALETTES[current][key as keyof Palette],
});

/**
 * Styles that follow the scheme: `const styles = themed(() => StyleSheet.create({...}))`.
 * Each scheme's styles are built once, the first time they are used.
 */
export function themed<T extends object>(make: () => T): T {
  const cache: Partial<Record<Scheme, T>> = {};
  return new Proxy({} as T, {
    get: (_, key) => {
      cache[current] ??= make();
      return cache[current]![key as keyof T];
    },
  });
}
