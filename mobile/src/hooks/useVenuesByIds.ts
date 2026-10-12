import { useEffect, useState } from 'react';

import { fetchVenuesByIds, type Venue } from '../lib/api';

export function useVenuesByIds(ids: number[]) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = [...ids].sort((a, b) => a - b).join(',');

  useEffect(() => {
    if (!key) {
      setVenues([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    fetchVenuesByIds(key.split(',').map(Number), controller.signal)
      .then((result) => {
        setVenues(result);
        setError(null);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Bilinmeyen hata');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [key]);

  return { venues, loading, error };
}
