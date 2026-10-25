export type Tag = 'socializing' | 'coworking' | 'entertainment' | 'quiet' | 'food' | 'nightlife' | 'wifi';

export const TAG_OPTIONS: { tag: Tag; label: string }[] = [
  { tag: 'socializing', label: 'Sosyalleşme' },
  { tag: 'coworking', label: 'Ortak çalışma' },
  { tag: 'entertainment', label: 'Eğlence' },
  { tag: 'quiet', label: 'Sessizlik' },
  { tag: 'food', label: 'Yemek' },
  { tag: 'nightlife', label: 'Gece hayatı' },
  { tag: 'wifi', label: 'Ücretsiz Wi-Fi' }, // from OpenStreetMap (internet_access without a fee)
];

/** Add the tag if missing, remove it if present; result is sorted for stable query keys. */
export function toggleTag(selected: Tag[], tag: Tag): Tag[] {
  const next = selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag];
  return next.sort();
}

const TR_FOLD: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', i̇: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

/** "Nişantaşı" -> "nisantasi", so searches typed on an English keyboard still match. */
export function foldTr(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/i̇|[çğıöşüâîû]/g, (ch) => TR_FOLD[ch] ?? ch);
}

/** Single choice that can be cleared by tapping the active option again. */
export function toggleSingle<T>(current: T | null, value: T): T | null {
  return current === value ? null : value;
}

const CATEGORY_LABELS: Record<string, string> = {
  cafe: 'Kafe',
  bar: 'Bar',
  coworking: 'Ortak çalışma',
  library: 'Kütüphane',
  restaurant: 'Restoran',
  park: 'Park',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? 'Mekan';
}
