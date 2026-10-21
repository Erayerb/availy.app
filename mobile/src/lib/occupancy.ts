export type Level = 'low' | 'medium' | 'high';

const LEVEL_STYLE: Record<Level, { color: string; label: string }> = {
  low: { color: '#2e9d4f', label: 'Sakin' },
  medium: { color: '#e0a800', label: 'Orta' },
  high: { color: '#D9480F', label: 'Kalabalık' },
};

// Okabe-Ito colours stay distinguishable with common colour blindness; glyphs add a non-colour cue
const COLOR_BLIND_STYLE: Record<Level, { color: string; glyph: string }> = {
  low: { color: '#0072B2', glyph: '✓' },
  medium: { color: '#E69F00', glyph: '~' },
  high: { color: '#D55E00', glyph: '!' },
};

const UNKNOWN_STYLE = { color: '#8a8a8a', label: 'Bilinmiyor', glyph: '?' };

export const CLOSED_STYLE = { color: '#A39E97', label: 'Kapalı', glyph: '×' };

// v2: venues without fresh check-ins
export const STALE_STYLE = { color: '#C9C2B8', label: 'Bilgi yok', glyph: '?' };
export const UNEXPLORED_STYLE = { color: '#7B5EA7', label: 'Keşfedilmedi', glyph: '✨' };

export type LevelLook = { color: string; label: string; glyph: string | null };

export function levelStyle(level: string, colorBlind = false): LevelLook {
  const base = LEVEL_STYLE[level as Level];
  if (!base) return UNKNOWN_STYLE;
  // "!" marks crowded places even in the normal palette
  if (!colorBlind) return { ...base, glyph: level === 'high' ? '!' : null };
  return { label: base.label, ...COLOR_BLIND_STYLE[level as Level] };
}

export const LEVELS = Object.keys(LEVEL_STYLE) as Level[];

/** 0.784 -> "%78 dolu" (Turkish puts the percent sign first). */
export function formatRatio(ratio: number): string {
  return `%${Math.round(ratio * 100)} dolu`;
}

const AREA_TEXT: Record<Level, string> = {
  low: 'Sakin',
  medium: 'Orta',
  high: 'Yoğun',
};

/** Area (district) busyness line on the venue card: "Bölge: Yoğun" */
export function areaStatus(level: string): string {
  return `Bölge: ${AREA_TEXT[level as Level] ?? 'Bilinmiyor'}`;
}

/** A level colour mixed with white, for a level only one person has reported. */
export function fadeColor(hex: string, amount = 0.5): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
