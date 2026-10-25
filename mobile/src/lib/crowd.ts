/**
 * v2: a venue's occupancy from recent check-ins ("crowd"), as sent by the
 * server. Display helpers live here so they can be tested.
 */
import type { Level } from './occupancy.ts';

export type CrowdState = 'live' | 'stale' | 'unexplored';

export type Crowd = {
  state: CrowdState;
  level: Level | null; // live only
  ratio: number | null; // only with at least 5 people in the last 90 minutes
  reporters: number;
  last_report_at: string | null;
  queue: boolean | null; // "Sıra var" (Kalabalık); not shown, it only moves the score
  seats: boolean | null; // "Oturacak yer var" (Orta); not shown, it only moves the score
  yesterday_level?: Level | null; // no fresh check-ins: the level at this time yesterday
};

export const UNEXPLORED: Crowd = {
  state: 'unexplored',
  level: null,
  ratio: null,
  reporters: 0,
  last_report_at: null,
  queue: null,
  seats: null,
};

// Same scores as the server (backend/app/crowd.py), used when no ratio is shown
const LEVEL_SCORE: Record<Level, number> = { low: 0.2, medium: 0.55, high: 0.9 };

type HasCrowd = { open_now: boolean; crowd?: Crowd };

/** The level to show right now: only for open venues with fresh check-ins. */
export function liveLevel(venue: HasCrowd): Level | null {
  return venue.open_now && venue.crowd?.state === 'live' ? venue.crowd.level : null;
}

// Below this many people the level is shown faded, as "1 kişiye göre Kalabalık"
export const CONFIRMED_REPORTERS = 2;

/** Only one person reported so far: shown, but not yet confirmed by anyone else. */
export function isTentative(venue: HasCrowd): boolean {
  return liveLevel(venue) !== null && (venue.crowd?.reporters ?? 0) < CONFIRMED_REPORTERS;
}

/** For sorting: lower is emptier; venues without fresh check-ins go last. */
export function crowdScore(venue: HasCrowd): number {
  const level = liveLevel(venue);
  if (level === null) return Infinity;
  return venue.crowd?.ratio ?? LEVEL_SCORE[level];
}

/** First letter in upper case, for text that starts a line ("Az önce", "Keşfetti"). */
export const sentence = (text: string) => text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1);

/** "az önce" / "12 dk önce" / "3 saat önce" / "2 gün önce" */
export function timeAgo(iso: string, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'az önce';
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  return `${Math.floor(hours / 24)} gün önce`;
}

/** A day and time: "Bugün 13:10", "Dün 09:05", "23 Eki 18:40" (the year only when it is not this year). */
export function dayAndTime(iso: string, now: Date): string {
  const at = new Date(iso);
  const time = at.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(at)) / 86_400_000);
  if (days === 0) return `Bugün ${time}`;
  if (days === 1) return `Dün ${time}`;
  const date = at.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    ...(at.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
  return `${date} ${time}`;
}

/** Second line under the level: who reported and when. */
export function crowdSummary(crowd: Crowd, now: Date): string {
  if (crowd.state === 'unexplored') return "Henüz kimse check-in yapmadı. İlk check-in'i sen yap!";
  if (!crowd.last_report_at) return 'Bilgi yok';
  const ago = timeAgo(crowd.last_report_at, now);
  if (crowd.state === 'stale') return `Son bildirim ${ago}`;
  return `Son bildirim ${ago} · ${crowd.reporters} kişi`;
}

/** "~%60" when enough people reported, otherwise null. */
export const crowdRatioText = (crowd: Crowd): string | null =>
  crowd.state === 'live' && crowd.ratio !== null ? `~%${Math.round(crowd.ratio * 100)}` : null;

const YESTERDAY: Record<Level, string> = { low: 'sakindi', medium: 'orta doluydu', high: 'kalabalıktı' };

/** No fresh check-ins: "Dün bu saatlerde kalabalıktı", or null when nobody checked in then either. */
export function crowdYesterday(crowd: Crowd): string | null {
  if (crowd.state !== 'stale' || !crowd.yesterday_level) return null;
  return `Dün bu saatlerde ${YESTERDAY[crowd.yesterday_level]}`;
}

