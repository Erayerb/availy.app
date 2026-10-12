import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchVenues, type Venue } from '../lib/api';

const POLL_INTERVAL_MS = 30_000;

/** Fetch venues for the given bbox and tags, refreshing every 30 seconds. */
export function useVenues(bbox: string, tags: string[]) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const lastKeyRef = useRef('');

  const tagsKey = tags.join(',');

  const load = useCallback(async () => {
    // Cancel an in-flight request so a stale bbox never overwrites a newer one
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const next = await fetchVenues(bbox, tagsKey ? tagsKey.split(',') : [], controller.signal);
      // Skip identical data so markers are not re-rendered on every poll
      const nextKey = JSON.stringify(next);
      if (nextKey !== lastKeyRef.current) {
        lastKeyRef.current = nextKey;
        setVenues(next);
      }
      setError(null);
      setLastUpdated(new Date());
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : 'Bilinmeyen hata');
    }
  }, [bbox, tagsKey]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      controllerRef.current?.abort();
    };
  }, [load]);

  return { venues, error, lastUpdated };
}
