export type Tag = 'socializing' | 'coworking' | 'entertainment' | 'quiet' | 'food';

export const TAG_OPTIONS: { tag: Tag; label: string }[] = [
  { tag: 'socializing', label: 'Sosyalleşme' },
  { tag: 'coworking', label: 'Co-working' },
  { tag: 'entertainment', label: 'Eğlence' },
  { tag: 'quiet', label: 'Sessizlik' },
  { tag: 'food', label: 'Yemek' },
];

/** Add the tag if missing, remove it if present; result is sorted for stable query keys. */
export function toggleTag(selected: Tag[], tag: Tag): Tag[] {
  const next = selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag];
  return next.sort();
}

/** Single choice that can be cleared by tapping the active option again. */
export function toggleSingle<T>(current: T | null, value: T): T | null {
  return current === value ? null : value;
}

const CATEGORY_LABELS: Record<string, string> = {
  cafe: 'Kafe',
  bar: 'Bar',
  coworking: 'Co-working',
  library: 'Kütüphane',
  restaurant: 'Restoran',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? 'Mekan';
}
