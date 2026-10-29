/** New badges (from /v1/me or a check-in) for the celebration pop-up; the points are already added. */
import { useEffect, useState } from 'react';

export type NewBadge = { id: string; name: string; icon: string; points: number };

const listeners = new Set<(badges: NewBadge[]) => void>();

export function celebrateBadges(badges: NewBadge[] | undefined): void {
  if (badges?.length) listeners.forEach((listener) => listener(badges));
}

/** The badges waiting to be celebrated, and a way to close the pop-up. */
export function useBadgeCelebration(): [NewBadge[], () => void] {
  const [waiting, setWaiting] = useState<NewBadge[]>([]);
  useEffect(() => {
    const listener = (badges: NewBadge[]) => setWaiting((current) => [...current, ...badges]);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return [waiting, () => setWaiting([])];
}
