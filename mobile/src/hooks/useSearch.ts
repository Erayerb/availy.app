import { useCallback, useEffect, useRef, useState } from 'react';

import { usePageFocused } from '../context/PageContext';
import { SPINNER_AFTER_MS } from './usePullRefresh';

import { searchVenues, type Venue } from '../lib/api';

const DEBOUNCE_MS = 300;
// Occupancy changes over time; refresh the list quietly this often
const REFRESH_MS = 30_000;

// What was last seen, so a page opened again shows it at once and updates quietly
const lastSeen = new Map<string, Venue[]>();

/**
 * Search venues by name/district/tags; waits until the user stops typing,
 * refreshes every 30 seconds and on pull-to-refresh (`refresh`).
 */
export function useSearch(query: string, district: string | null, tags: string[]) {
  const seenKey = `${query.trim()}|${district ?? ''}|${tags.join(',')}`;
  const [venues, setVenues] = useState<Venue[]>(() => lastSeen.get(seenKey) ?? []);
  const [loading, setLoading] = useState(!lastSeen.has(seenKey));
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const spinnerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tick, setTick] = useState(0);
  const focused = usePageFocused();
  // Refreshes keep the current list on screen instead of showing "Yükleniyor…"
  const quiet = useRef(false);
  const tagsKey = tags.join(',');

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
    const controller = new AbortController();
    const isRefresh = quiet.current;
    quiet.current = false;
    const seen = lastSeen.get(seenKey);
    if (seen) setVenues(seen);
    if (!isRefresh && !seen) setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchVenues(query.trim(), district, tagsKey ? tagsKey.split(',') : [], controller.signal);
        lastSeen.set(seenKey, found);
        setVenues(found);
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
