/** Istanbul sides for the "Konum" filter: Europe / Anatolia, then districts. */
export type Side = 'europe' | 'anatolia';

export const SIDE_OPTIONS: { side: Side; label: string }[] = [
  { side: 'europe', label: 'İstanbul (Avr.)' },
  { side: 'anatolia', label: 'İstanbul (Anadolu)' },
];

const EUROPE = [
  'Arnavutköy', 'Avcılar', 'Bağcılar', 'Bahçelievler', 'Bakırköy', 'Başakşehir', 'Bayrampaşa', 'Beşiktaş',
  'Beylikdüzü', 'Beyoğlu', 'Büyükçekmece', 'Çatalca', 'Esenler', 'Esenyurt', 'Eyüpsultan', 'Fatih',
  'Gaziosmanpaşa', 'Güngören', 'Kağıthane', 'Küçükçekmece', 'Sarıyer', 'Silivri', 'Sultangazi', 'Şişli',
  'Zeytinburnu',
];
const ANATOLIA = [
  'Adalar', 'Ataşehir', 'Beykoz', 'Çekmeköy', 'Kadıköy', 'Kartal', 'Maltepe', 'Pendik', 'Sancaktepe',
  'Sultanbeyli', 'Şile', 'Tuzla', 'Ümraniye', 'Üsküdar',
];

const SIDE_OF = new Map<string, Side>([
  ...EUROPE.map((d) => [d, 'europe'] as const),
  ...ANATOLIA.map((d) => [d, 'anatolia'] as const),
]);

/** All 39 Istanbul districts in Turkish alphabetical order. */
export const ALL_DISTRICTS = [...EUROPE, ...ANATOLIA].sort((a, b) => a.localeCompare(b, 'tr'));

export const sideOf = (district: string): Side | null => SIDE_OF.get(district) ?? null;

/** No side or both sides selected means the whole city. */
const wholeCity = (sides: Side[]) => sides.length === 0 || sides.length === SIDE_OPTIONS.length;

export function matchesSides(district: string, sides: Side[]): boolean {
  if (wholeCity(sides)) return true;
  const side = sideOf(district);
  return side !== null && sides.includes(side);
}

export const districtsForSides = (districts: string[], sides: Side[]) =>
  districts.filter((d) => matchesSides(d, sides));

/** Venue district passes the chosen districts (none chosen = any). */
export const matchesDistricts = (district: string, chosen: string[]) =>
  chosen.length === 0 || chosen.includes(district);

export function toggleSide(sides: Side[], side: Side): Side[] {
  return sides.includes(side) ? sides.filter((s) => s !== side) : [...sides, side];
}
