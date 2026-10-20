/**
 * v2: a venue's occupancy from recent check-ins ("crowd"), as sent by the
 * server. Display helpers live here so they can be tested.
 */
import type { Level } from './occupancy.ts';

export type CrowdState = 'live' | 'stale' | 'unexplored';

export type Crowd = {
  state: CrowdState;
  level: Level | null; // live only
  ratio: number | null; // only with at least 3 people in the last 90 minutes
  reporters: number;
  last_report_at: string | null;
  queue: boolean | null; // "Sıra var" (Kalabalık)
  seats: boolean | null; // "Oturacak yer var" (Orta)
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

/** For sorting: lower is emptier; venues without fresh check-ins go last. */
export function crowdScore(venue: HasCrowd): number {
  const level = liveLevel(venue);
  if (level === null) return Infinity;
  return venue.crowd?.ratio ?? LEVEL_SCORE[level];
}

/** "az önce" / "12 dk önce" / "3 saat önce" / "2 gün önce" */
export function timeAgo(iso: string, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'az önce';
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  return `${Math.floor(hours / 24)} gün önce`;
}

/** Second line under the level: who reported and when. */
export function crowdSummary(crowd: Crowd, now: Date): string {
  if (crowd.state === 'unexplored') return "Henüz kimse check-in yapmadı. İlk check-in'i sen yap!";
  if (!crowd.last_report_at) return 'Bilgi yok';
  const ago = timeAgo(crowd.last_report_at, now);
  if (crowd.state === 'stale') return `Son bildirim ${ago} · güncel bilgi yok`;
  return `Son bildirim ${ago} · ${crowd.reporters} kişi`;
}

/** "~%60" when enough people reported, otherwise null. */
export const crowdRatioText = (crowd: Crowd): string | null =>
  crowd.state === 'live' && crowd.ratio !== null ? `~%${Math.round(crowd.ratio * 100)}` : null;

/** "Sıra var" / "Oturacak yer yok" … from the follow-up answers, or null. */
export function crowdExtra(crowd: Crowd): string | null {
  if (crowd.state !== 'live') return null;
  if (crowd.queue !== null) return crowd.queue ? 'Sıra var' : 'Sıra yok';
  if (crowd.seats !== null) return crowd.seats ? 'Oturacak yer var' : 'Oturacak yer yok';
  return null;
}
