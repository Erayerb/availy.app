/** Only registered users have favorites; guests and visitors are asked to sign in. */
export const FAVORITES_REQUIRE_LOGIN = true;

export function toggleFavorite(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/** Read stored favorites defensively; anything unexpected becomes an empty list. */
export function parseFavorites(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((x): x is number => Number.isInteger(x)))];
}
