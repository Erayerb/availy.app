import { useCallback, useRef, useState } from 'react';

// A refresh that finishes sooner shows no spinner and holds nothing up
export const SPINNER_AFTER_MS = 300;

/** For a page's RefreshControl: `<RefreshControl {...usePullRefresh(reload)} />`. */
export function usePullRefresh(reload: () => unknown) {
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRefresh = useCallback(async () => {
    timer.current = setTimeout(() => setRefreshing(true), SPINNER_AFTER_MS);
    await reload();
    if (timer.current) clearTimeout(timer.current);
    setRefreshing(false);
  }, [reload]);
  return { refreshing, onRefresh };
}
