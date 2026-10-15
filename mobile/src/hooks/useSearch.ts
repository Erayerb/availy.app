import { useCallback, useEffect, useRef, useState } from 'react';

import { searchVenues, type Venue } from '../lib/api';

const DEBOUNCE_MS = 300;
// Occupancy changes over time; refresh the list quietly this often
const REFRESH_MS = 30_000;
// Keep the pull-to-refresh spinner visible this long, so the user sees that it refreshed
const MIN_SPINNER_MS = 800;

/**
 * Search venues by name/district/tags; waits until the user stops typing,
 * refreshes every 30 seconds and on pull-to-refresh (`refresh`).
 */
export function useSearch(query: string, district: string | null, tags: string[]) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const pulledAt = useRef(0);
  const [tick, setTick] = useState(0);
  // Refreshes keep the current list on screen instead of showing "Yükleniyor…"
  const quiet = useRef(false);
  const tagsKey = tags.join(',');

  const stopSpinner = () => {
    setUpdatedAt(new Date());
    const wait = Math.max(0, pulledAt.current + MIN_SPINNER_MS - Date.now());
    setTimeout(() => setRefreshing(false), wait);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      quiet.current = true;
      setTick((n) => n + 1);
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const isRefresh = quiet.current;
    quiet.current = false;
    if (!isRefresh) setLoading(true);
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
        if (!controller.signal.aborted) {
          setLoading(false);
          stopSpinner();
        }
      }
    }, query && !isRefresh ? DEBOUNCE_MS : 0);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, district, tagsKey, tick]);

  const refresh = useCallback(() => {
    quiet.current = true;
    pulledAt.current = Date.now();
    setRefreshing(true);
    setTick((n) => n + 1);
  }, []);

  return { venues, loading, error, refreshing, refresh, updatedAt };
}
