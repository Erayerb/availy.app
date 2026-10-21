/**
 * Opening hours (demo), mirroring backend/app/hours.py: by category, Istanbul
 * time. A closing hour <= opening hour means closing after midnight.
 */
const HOURS_BY_CATEGORY: Record<string, [number, number]> = {
  cafe: [8, 23],
  bar: [17, 3],
  restaurant: [11, 24],
  coworking: [8, 22],
  library: [9, 21],
  park: [0, 24],
};
const DEFAULT_HOURS: [number, number] = [9, 22];
const ALL_DAY: [number, number] = [0, 24];
const ISTANBUL_UTC_OFFSET_HOURS = 3;

export function hoursFor(category: string, alwaysBusy = false): [number, number] {
  return alwaysBusy ? ALL_DAY : (HOURS_BY_CATEGORY[category] ?? DEFAULT_HOURS);
}

export function isOpenAtHour([open, close]: [number, number], hour: number): boolean {
  if (open === 0 && close === 24) return true;
  const end = close % 24;
  return open < end ? open <= hour && hour < end : hour >= open || hour < end;
}

const pad = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;

export function hoursLabel([open, close]: [number, number]): string {
  return open === 0 && close === 24 ? '24 saat açık' : `${pad(open)}–${pad(close)}`;
}

export const opensAt = ([open]: [number, number]) => pad(open);

export const istanbulHour = (at: Date) => (at.getUTCHours() + ISTANBUL_UTC_OFFSET_HOURS) % 24;
