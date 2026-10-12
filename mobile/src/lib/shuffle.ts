/** Small deterministic string hash (FNV-1a). */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Mixed order that stays the same for the same seed, so suggestions don't
 * reshuffle on every refresh but differ between app sessions.
 */
export function stableShuffle<T extends { id: number }>(items: T[], seed: string): T[] {
  return [...items].sort((a, b) => hash(`${seed}:${a.id}`) - hash(`${seed}:${b.id}`));
}
