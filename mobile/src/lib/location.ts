/** "Moda, Kadıköy"; falls back gracefully when a part is missing. */
export function shortLocation(neighborhood: string, district: string): string {
  return [neighborhood, district].filter(Boolean).join(', ');
}

/** Apple Maps on iOS, Google Maps elsewhere; both open turn-by-turn directions. */
export function directionsUrl(os: string, lat: number, lon: number): string {
  const destination = `${lat},${lon}`;
  if (os === 'ios') {
    return `http://maps.apple.com/?daddr=${destination}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}
