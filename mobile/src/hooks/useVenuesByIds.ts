import { useCallback, useEffect, useRef, useState } from 'react';

import { usePageFocused } from '../context/PageContext';
import { SPINNER_AFTER_MS } from './usePullRefresh';

import { fetchVenuesByIds, type Venue } from '../lib/api';

// Occupancy changes over time; refresh quietly this often
const REFRESH_MS = 30_000;

// What was last seen, so a page opened again shows it at once and updates quietly
const lastSeen = new Map<string, Venue[]>();

/** Venues by id (favorites, detail page); refreshes every 30 seconds and on pull-to-refresh. */
export function useVenuesByIds(ids: number[]) {
  const key = [...ids].sort((a, b) => a - b).join(',');
  const [venues, setVenues] = useState<Venue[]>(() => lastSeen.get(key) ?? []);
  const [loading, setLoading] = useState(!lastSeen.has(key));
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const spinnerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tick, setTick] = useState(0);
  const focused = usePageFocused();
  // Refreshes keep the current data on screen instead of showing "Yükleniyor…"
  const quiet = useRef(false);

  const stopSpinner = () => {
    setUpdatedAt(new Date());
    if (spinnerTimer.current) clearTimeout(spinnerTimer.current);
    setRefreshing(false);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (!focused.current) return;
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
    const seen = lastSeen.get(key);
    if (seen) setVenues(seen);
    if (!isRefresh && !seen) setLoading(true);
    fetchVenuesByIds(key.split(',').map(Number), controller.signal)
      .then((result) => {
        lastSeen.set(key, result);
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

  // Coming back to the page: new data without any spinner
  const update = useCallback(() => {
    quiet.current = true;
    setTick((n) => n + 1);
  }, []);

  const refresh = useCallback(() => {
    quiet.current = true;
    // A refresh that finishes sooner shows no spinner
    spinnerTimer.current = setTimeout(() => setRefreshing(true), SPINNER_AFTER_MS);
    setTick((n) => n + 1);
  }, []);

  return { venues, loading, error, refreshing, refresh, update, updatedAt };
}
