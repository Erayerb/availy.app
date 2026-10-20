import { useEffect, useState } from 'react';

import { fetchVisits, type Visit } from '../lib/checkinApi';

/** Venues the signed-in user checked in at ("Ziyaret ettiklerim"); reloads when `version` changes. */
export function useVisits(token: string | undefined, version: unknown): Visit[] {
  const [visits, setVisits] = useState<Visit[]>([]);
  useEffect(() => {
    if (!token) {
      setVisits([]);
      return;
    }
    let stale = false;
    fetchVisits(token)
      .then((list) => !stale && setVisits(list))
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [token, version]);
  return visits;
}
