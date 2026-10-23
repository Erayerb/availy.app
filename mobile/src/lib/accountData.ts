/**
 * Data kept on this phone is keyed by the account (accountKey = e-mail). When the e-mail
 * changes, move it to the new key so favorites, stamp cards and the like stay.
 */
import { KEYS, loadJson, saveJson } from './storage.ts';

type Keyed = { userKey: string };

/** Lists whose items carry the owner's key. */
const OWNED_LISTS = [KEYS.stampCards, KEYS.memberships] as const;

export function rekey<T extends Keyed>(items: T[], from: string, to: string): T[] {
  return items.map((item) => (item.userKey === from ? { ...item, userKey: to } : item));
}

export async function moveAccountData(from: string, to: string): Promise<void> {
  if (from === to) return;
  for (const key of OWNED_LISTS) {
    const items = await loadJson<Keyed[]>(key);
    if (Array.isArray(items)) await saveJson(key, rekey(items, from, to));
  }
  // Favorites: one list per account
  const favorites = await loadJson<unknown>(`${KEYS.favorites}.${from}`);
  if (favorites !== null && (await loadJson<unknown>(`${KEYS.favorites}.${to}`)) === null) {
    await saveJson(`${KEYS.favorites}.${to}`, favorites);
  }
  // When the 🔔 list was last opened
  const seen = await loadJson<Record<string, string>>(KEYS.notificationsSeen);
  if (seen?.[from]) await saveJson(KEYS.notificationsSeen, { ...seen, [to]: seen[from] });
}
