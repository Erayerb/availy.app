import type { IconName } from '../components/Icon';
import { isDarkScheme } from '../theme.ts';

/**
 * Placeholder "photo" per category until real venue photos exist. The gradients keep away from the crowd
 * colours (green Sakin, yellow Orta, orange / red Kalabalık), so a card's colour is never read as how busy it is.
 */
// tile / accent: the card without a photo (option G): a deep tone of the type, and its big line drawing's colour
type Visual = { icon: IconName; color: string; background: string; gradient: [string, string]; tile: string; accent: string };

const VISUALS: Record<string, Visual> = {
  cafe: { icon: 'coffee', color: '#8a5a2b', background: '#f6e3c8', gradient: ['#3B2A5C', '#8A5CC9'], tile: '#2B2018', accent: '#C9962B' },
  bar: { icon: 'glass-full', color: '#7a3e8f', background: '#ead7f3', gradient: ['#1F2A5C', '#4A63D6'], tile: '#1D1F30', accent: '#7B86E8' },
  coworking: { icon: 'device-laptop', color: '#2f6aa3', background: '#d7e8f8', gradient: ['#123C4A', '#1E8FA8'], tile: '#142629', accent: '#3FA7B9' },
  library: { icon: 'books', color: '#3b7a3b', background: '#dcf0dc', gradient: ['#2C3A4A', '#5E7A99'], tile: '#1F252D', accent: '#8BA3C0' },
  restaurant: { icon: 'tools-kitchen-2', color: '#b0503a', background: '#f8dcd2', gradient: ['#4A2340', '#B04A8E'], tile: '#2B1A22', accent: '#C9578A' },
  park: { icon: 'leaf', color: '#3b7a3b', background: '#d9efd3', gradient: ['#1F3A40', '#3E8C8C'], tile: '#18292A', accent: '#4FA39A' },
};

const FALLBACK: Visual = { icon: 'map-pin', color: '#6b7280', background: '#e5e7eb', gradient: ['#2E3440', '#64748B'], tile: '#22252B', accent: '#7C8794' };

/** Mix a pastel with the dark page colour, so the tiles are not glaring in the dark theme. */
function darken(hex: string, amount = 0.72): string {
  const n = parseInt(hex.slice(1), 16);
  const dark = [0x17, 0x11, 0x0e];
  const mix = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c, i) => Math.round(c + (dark[i] - c) * amount));
  return `#${((mix[0] << 16) | (mix[1] << 8) | mix[2]).toString(16).padStart(6, '0')}`;
}

export function categoryVisual(category: string, dark = isDarkScheme()): Visual {
  const visual = VISUALS[category] ?? FALLBACK;
  // On the dark tile the light pastel becomes the icon colour; the light theme's card is the pastel with the
  // type's darker colour for its drawing
  return dark
    ? { ...visual, color: visual.background, background: darken(visual.background) }
    : { ...visual, tile: visual.background, accent: visual.color };
}
