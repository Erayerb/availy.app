/** v2 "Genelde 18:00'de kalabalık": usual busy / quiet hours from past weeks (GET /v1/venues/{id}/typical). */
import { send } from './accountApi.ts';
import type { Level } from './occupancy.ts';

export type Typical = {
  scope: 'today' | 'all' | null; // this weekday, all days together, or not enough check-ins yet
  weekday: number; // Monday = 0
  busy_hours: number[];
  quiet_hours: number[];
  usual_now?: Level | null; // the usual level at this hour (earlier days)
};

const LEVEL_NAMES: Record<Level, string> = { low: 'Sakin', medium: 'Orta', high: 'Kalabalık' };
const RANK: Record<Level, number> = { low: 0, medium: 1, high: 2 };

/**
 * "Şu an normalden daha sakin (bu saatte genelde Kalabalık)": the live level against the usual one
 * at this hour. Null when they match, or without a live level or enough past check-ins.
 */
export function comparedToUsual(live: Level | null, usual: Level | null | undefined): string | null {
  if (!live || !usual || live === usual) return null;
  const quieter = RANK[live] < RANK[usual];
  return `${quieter ? 'Şu an normalden daha sakin' : 'Şu an normalden daha kalabalık'} (bu saatte genelde ${LEVEL_NAMES[usual]})`;
}

/**
 * No live report right now: "Genelde bu saatte sakin (tahmini)", from this venue's own past check-ins at
 * this hour. Null with a live level (that one is shown) or without enough past check-ins.
 */
export function usualNowText(live: Level | null, usual: Level | null | undefined): string | null {
  if (live || !usual) return null;
  return `Genelde bu saatte ${LEVEL_NAMES[usual].toLocaleLowerCase('tr-TR')} (tahmini)`;
}

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const hh = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;

/** [18, 19, 21] -> "18:00–20:00 ve 21:00–22:00" (each hour covers until the next). */
export function hourRanges(hours: number[]): string {
  const ranges: [number, number][] = [];
  for (const h of [...hours].sort((a, b) => a - b)) {
    const last = ranges[ranges.length - 1];
    if (last && h === last[1]) last[1] = h + 1;
    else ranges.push([h, h + 1]);
  }
  const parts = ranges.map(([a, b]) => `${hh(a)}–${hh(b)}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} ve ${parts[parts.length - 1]}` : (parts[0] ?? '');
}

/** "Cumartesi günleri genelde 18:00–20:00 kalabalık" and "En sakin: 10:00–11:00"; empty without enough data. */
export function typicalLines(t: Typical): string[] {
  if (!t.scope) return [];
  const when = t.scope === 'today' ? `${DAYS[t.weekday]} günleri genelde` : 'Genelde';
  const lines: string[] = [];
  if (t.busy_hours.length) lines.push(`${when} ${hourRanges(t.busy_hours)} kalabalık`);
  if (t.quiet_hours.length) lines.push(`${t.busy_hours.length ? 'En sakin' : `${when} en sakin`}: ${hourRanges(t.quiet_hours)}`);
  return lines;
}

export const fetchTypical = (venueId: number) => send<Typical>('GET', `/v1/venues/${venueId}/typical`);
