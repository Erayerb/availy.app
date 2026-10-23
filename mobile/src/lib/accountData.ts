/**
 * Data kept on this phone is keyed by the account (accountKey = e-mail). When the e-mail
 * changes, move it to the new key so favorites and the 🔔 "read" mark stay.
 */
import { KEYS, loadJson, saveJson } from './storage.ts';

export async function moveAccountData(from: string, to: string): Promise<void> {
  if (from === to) return;
  // Favorites: one list per account
  const favorites = await loadJson<unknown>(`${KEYS.favorites}.${from}`);
  if (favorites !== null && (await loadJson<unknown>(`${KEYS.favorites}.${to}`)) === null) {
    await saveJson(`${KEYS.favorites}.${to}`, favorites);
  }
  // When the 🔔 list was last opened
  const seen = await loadJson<Record<string, string>>(KEYS.notificationsSeen);
  if (seen?.[from]) await saveJson(KEYS.notificationsSeen, { ...seen, [to]: seen[from] });
}
