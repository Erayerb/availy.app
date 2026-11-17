/** Places from open data not on the map yet ("Haritada yok mu?"): found by search, added on the spot. */
import { send } from './accountApi.ts';

export type Candidate = { id: string; name: string; category: string; lat: number; lon: number; distance_m: number | null };

export const candidatesApi = {
  search: (q: string, point?: { lat: number; lon: number } | null) => {
    const params = new URLSearchParams({ q });
    if (point) {
      params.set('lat', String(point.lat));
      params.set('lon', String(point.lon));
    }
    return send<Candidate[]>('GET', `/v1/places/candidates?${params}`);
  },
  // "Ekle ve check-in yap": becomes a venue (or the venue it already is)
  add: (token: string, id: string) => send<{ id: number; created: boolean }>('POST', `/v1/places/candidates/${encodeURIComponent(id)}/venue`, undefined, token),
};
