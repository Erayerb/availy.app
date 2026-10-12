import { useEffect, useState } from 'react';

import { fetchHourly, fetchVenuesByIds, searchVenues, type HourlyPoint, type Venue } from '../lib/api';

const REFRESH_MS = 30_000;

/** The business's own venue, today's hourly occupancy and all venues (for comparison). */
export function useBusinessData(venueId: number, reloadKey = 0) {
  const [venue, setVenue] = useState<Venue | null>(null);
  const [hourly, setHourly] = useState<HourlyPoint[]>([]);
  const [all, setAll] = useState<Venue[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const [mine, hours, everyone] = await Promise.all([
          fetchVenuesByIds([venueId], controller.signal),
          fetchHourly(venueId, controller.signal),
          searchVenues('', null, [], controller.signal),
        ]);
        setVenue(mine[0] ?? null);
        setHourly(hours);
        setAll(everyone);
        setError(mine[0] ? null : 'Mekan bulunamadı.');
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Bilinmeyen hata');
      }
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [venueId, reloadKey]);

  return { venue, hourly, all, error };
}
