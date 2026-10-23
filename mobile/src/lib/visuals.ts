import { getScheme } from '../theme.ts';

/** Placeholder "photo" per category until real venue photos exist. */
const VISUALS: Record<string, { emoji: string; background: string }> = {
  cafe: { emoji: '☕', background: '#f6e3c8' },
  bar: { emoji: '🍸', background: '#ead7f3' },
  coworking: { emoji: '💻', background: '#d7e8f8' },
  library: { emoji: '📚', background: '#dcf0dc' },
  restaurant: { emoji: '🍽️', background: '#f8dcd2' },
  park: { emoji: '🌳', background: '#d9efd3' },
};

const FALLBACK = { emoji: '📍', background: '#e5e7eb' };

/** Mix a pastel with the dark page colour, so the tiles are not glaring in the dark theme. */
function darken(hex: string, amount = 0.72): string {
  const n = parseInt(hex.slice(1), 16);
  const dark = [0x17, 0x11, 0x0e];
  const mix = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c, i) => Math.round(c + (dark[i] - c) * amount));
  return `#${((mix[0] << 16) | (mix[1] << 8) | mix[2]).toString(16).padStart(6, '0')}`;
}

export function categoryVisual(category: string, dark = getScheme() === 'dark'): { emoji: string; background: string } {
  const visual = VISUALS[category] ?? FALLBACK;
  return dark ? { ...visual, background: darken(visual.background) } : visual;
}
