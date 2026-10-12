import { useEffect, useState } from 'react';

import { searchVenues, type Venue } from '../lib/api';

const DEBOUNCE_MS = 300;

/** Search venues by name/district/tags; waits until the user stops typing. */
export function useSearch(query: string, district: string | null, tags: string[]) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tagsKey = tags.join(',');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        setVenues(
          await searchVenues(query.trim(), district, tagsKey ? tagsKey.split(',') : [], controller.signal),
        );
        setError(null);
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'Bilinmeyen hata');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query ? DEBOUNCE_MS : 0);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, district, tagsKey]);

  return { venues, loading, error };
}
