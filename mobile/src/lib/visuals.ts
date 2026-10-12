/** Placeholder "photo" per category until real venue photos exist. */
const VISUALS: Record<string, { emoji: string; background: string }> = {
  cafe: { emoji: '☕', background: '#f6e3c8' },
  bar: { emoji: '🍸', background: '#ead7f3' },
  coworking: { emoji: '💻', background: '#d7e8f8' },
  library: { emoji: '📚', background: '#dcf0dc' },
  restaurant: { emoji: '🍽️', background: '#f8dcd2' },
};

const FALLBACK = { emoji: '📍', background: '#e5e7eb' };

export function categoryVisual(category: string): { emoji: string; background: string } {
  return VISUALS[category] ?? FALLBACK;
}
