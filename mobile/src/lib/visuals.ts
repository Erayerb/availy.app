import type { IconName } from '../components/Icon';
import { isDarkScheme } from '../theme.ts';

/** Placeholder "photo" per category until real venue photos exist. */
type Visual = { icon: IconName; color: string; background: string; gradient: [string, string] };

const VISUALS: Record<string, Visual> = {
  cafe: { icon: 'coffee', color: '#8a5a2b', background: '#f6e3c8', gradient: ['#7A2E1F', '#C8102E'] },
  bar: { icon: 'glass-full', color: '#7a3e8f', background: '#ead7f3', gradient: ['#2B2350', '#7B5EA7'] },
  coworking: { icon: 'device-laptop', color: '#2f6aa3', background: '#d7e8f8', gradient: ['#13304F', '#2F6AA3'] },
  library: { icon: 'books', color: '#3b7a3b', background: '#dcf0dc', gradient: ['#123A2A', '#2E9E4F'] },
  restaurant: { icon: 'tools-kitchen-2', color: '#b0503a', background: '#f8dcd2', gradient: ['#5A3A12', '#B7791F'] },
  park: { icon: 'leaf', color: '#3b7a3b', background: '#d9efd3', gradient: ['#123A2A', '#3B9A5B'] },
};

const FALLBACK: Visual = { icon: 'map-pin', color: '#6b7280', background: '#e5e7eb', gradient: ['#3A3F47', '#6B7280'] };

/** Mix a pastel with the dark page colour, so the tiles are not glaring in the dark theme. */
function darken(hex: string, amount = 0.72): string {
  const n = parseInt(hex.slice(1), 16);
  const dark = [0x17, 0x11, 0x0e];
  const mix = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c, i) => Math.round(c + (dark[i] - c) * amount));
  return `#${((mix[0] << 16) | (mix[1] << 8) | mix[2]).toString(16).padStart(6, '0')}`;
}

export function categoryVisual(category: string, dark = isDarkScheme()): Visual {
  const visual = VISUALS[category] ?? FALLBACK;
  // On the dark tile the light pastel becomes the icon colour
  return dark ? { ...visual, color: visual.background, background: darken(visual.background) } : visual;
}
