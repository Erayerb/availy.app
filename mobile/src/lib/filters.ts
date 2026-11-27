export type Tag = 'socializing' | 'coworking' | 'entertainment' | 'quiet' | 'food' | 'nightlife' | 'wifi';

export const TAG_OPTIONS: { tag: Tag; label: string }[] = [
  { tag: 'socializing', label: 'Sosyalleşme' },
  { tag: 'coworking', label: 'Ortak çalışma' },
  { tag: 'entertainment', label: 'Eğlence' },
  { tag: 'quiet', label: 'Sessizlik' },
  { tag: 'food', label: 'Yemek' },
  { tag: 'nightlife', label: 'Gece hayatı' },
  // 'wifi' is no filter any more (it still shows on the venue page as a feature)
];

/**
 * "Ne arıyorsun?" opens on what people usually look for at this hour: work in the morning and afternoon on
 * weekdays (breakfast / going out on weekends), food at lunch and dinner, going out in the evening, nightlife late.
 */
export function tagForTime(now: Date): Tag {
  const hour = now.getHours();
  const weekend = now.getDay() === 0 || now.getDay() === 6;
  if (hour < 6 || hour >= 22) return 'nightlife';
  if (hour < 11) return weekend ? 'food' : 'coworking';
  if (hour < 14) return 'food';
  if (hour < 18) return weekend ? 'socializing' : 'coworking';
  if (hour < 20) return 'food';
  return 'socializing';
}

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
