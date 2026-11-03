/**
 * v2 check-in suggestions: after a few minutes near an open venue, ask
 * "Burası şu an nasıl?". Event-driven (arriving somewhere), never on a timer.
 */
export const SUGGEST_RADIUS_KM = 0.15; // the same as a check-in's: further away the check-in would be refused
export const DWELL_MS = 5 * 60_000;
// Same as the server: one check-in per venue every 90 minutes
export const COOLDOWN_MS = 90 * 60_000;
// A street of cafes must not mean a question every few minutes: at most this often, also after reopening the app
export const ANY_ASK_GAP_MS = 60 * 60_000;
export const SAME_VENUE_DAY_MS = 24 * 60 * 60_000;
export const SAME_VENUE_MAX_ASKS = 2;

/** When we asked in the last day, per venue (kept on the phone). */
export type Asked = Record<string, number[]>;

export function mayAsk(asked: Asked, venueId: number, now: number): boolean {
  const last = Math.max(0, ...Object.values(asked).flat());
  const here = (asked[venueId] ?? []).filter((at) => now - at < SAME_VENUE_DAY_MS);
  return now - last >= ANY_ASK_GAP_MS && here.length < SAME_VENUE_MAX_ASKS;
}

/** Remembers this question; ones older than a day no longer matter. */
export function rememberAsked(asked: Asked, venueId: number, now: number): Asked {
  const kept = Object.entries(asked)
    .map(([id, times]) => [id, times.filter((at) => now - at < SAME_VENUE_DAY_MS)] as const)
    .filter(([, times]) => times.length > 0);
  const all: Asked = Object.fromEntries(kept);
  return { ...all, [venueId]: [...(all[venueId] ?? []), now] };
}

/** Where the user has been standing, and since when. */
export type Stay = { venueId: number; since: number; suggested: boolean };

/** Same venue: the stay goes on. Another venue or none (walked away): a new stay or nothing. */
export function nextStay(prev: Stay | null, venueId: number | null, now: number): Stay | null {
  if (venueId === null) return null;
  if (prev && prev.venueId === venueId) return prev;
  return { venueId, since: now, suggested: false };
}

/**
 * Ask once per stay, after a few minutes. Coming back later asks again, also
 * for a venue checked in at before, unless a check-in there is still too recent.
 */
export function shouldSuggest(stay: Stay | null, now: number, lastCheckinAt: number | null): boolean {
  if (!stay || stay.suggested || now - stay.since < DWELL_MS) return false;
  return lastCheckinAt === null || now - lastCheckinAt >= COOLDOWN_MS;
}

export function suggestionText(venueName: string, visits: number): { title: string; body: string } {
  return visits > 0
    ? { title: `Yine ${venueName} yakınındasın`, body: `Daha önce ${visits} kez check-in yaptın. Burası şu an nasıl?` }
    : { title: `${venueName} yakınındasın`, body: 'Burası şu an nasıl? Check-in yap, puan kazan.' };
}
