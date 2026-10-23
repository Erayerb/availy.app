/**
 * v2 check-in suggestions: after a few minutes near an open venue, ask
 * "Burası şu an nasıl?". Event-driven (arriving somewhere), never on a timer.
 */
export const SUGGEST_RADIUS_KM = 0.25;
export const DWELL_MS = 3 * 60_000;
// Same as the server: one check-in per venue every 90 minutes
export const COOLDOWN_MS = 90 * 60_000;

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
