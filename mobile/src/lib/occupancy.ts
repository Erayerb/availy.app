export type Level = 'low' | 'medium' | 'high';

const LEVEL_STYLE: Record<Level, { color: string; label: string }> = {
  low: { color: '#2e9d4f', label: 'Sakin' },
  medium: { color: '#e0a800', label: 'Orta' },
  high: { color: '#d64545', label: 'Kalabalık' },
};

const UNKNOWN_STYLE = { color: '#8a8a8a', label: 'Bilinmiyor' };

export function levelStyle(level: string): { color: string; label: string } {
  return LEVEL_STYLE[level as Level] ?? UNKNOWN_STYLE;
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
