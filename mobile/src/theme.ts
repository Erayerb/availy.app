/**
 * App palette: red + cream (light) and warm dark brown (dark). Occupancy colors
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

export type Scheme = 'light' | 'dark';

let current: Scheme = 'light';

export const getScheme = (): Scheme => current;

/** Called by ThemeGate while rendering, before any screen reads a color. */
export function setScheme(scheme: Scheme): void {
  current = scheme;
}

/** The palette of the current scheme; `colors.text` works anywhere, as before. */
export const colors: Palette = new Proxy({} as Palette, {
  get: (_, key) => (current === 'dark' ? darkColors : lightColors)[key as keyof Palette],
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
