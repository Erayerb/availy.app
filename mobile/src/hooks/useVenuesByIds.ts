import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchVenuesByIds, type Venue } from '../lib/api';

// Occupancy changes over time; refresh quietly this often
const REFRESH_MS = 30_000;
// Keep the pull-to-refresh spinner visible this long, so the user sees that it refreshed
const MIN_SPINNER_MS = 800;

/** Venues by id (favorites, detail page); refreshes every 30 seconds and on pull-to-refresh. */
export function useVenuesByIds(ids: number[]) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const pulledAt = useRef(0);
  const [tick, setTick] = useState(0);
  // Refreshes keep the current data on screen instead of showing "Yükleniyor…"
  const quiet = useRef(false);
  const key = [...ids].sort((a, b) => a - b).join(',');

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
    const isRefresh = quiet.current;
    quiet.current = false;
    if (!key) {
      setVenues([]);
      setLoading(false);
      stopSpinner();
      return;
    }
    const controller = new AbortController();
    if (!isRefresh) setLoading(true);
    fetchVenuesByIds(key.split(',').map(Number), controller.signal)
      .then((result) => {
        setVenues(result);
        setError(null);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Bilinmeyen hata');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          stopSpinner();
        }
      });
    return () => controller.abort();
  }, [key, tick]);

  const refresh = useCallback(() => {
    quiet.current = true;
    pulledAt.current = Date.now();
    setRefreshing(true);
    setTick((n) => n + 1);
  }, []);

  return { venues, loading, error, refreshing, refresh, updatedAt };
}
