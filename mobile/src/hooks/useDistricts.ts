import { useEffect, useState } from 'react';

import { fetchDistricts } from '../lib/api';
import { ALL_DISTRICTS } from '../lib/istanbul';

const merge = (extra: string[]) =>
  [...new Set([...ALL_DISTRICTS, ...extra])].sort((a, b) => a.localeCompare(b, 'tr'));

/** Every Istanbul district, plus any other district that venues use. */
export function useDistricts() {
  const [districts, setDistricts] = useState<string[]>(ALL_DISTRICTS);

  useEffect(() => {
    const controller = new AbortController();
    fetchDistricts(controller.signal)
      .then((fromVenues) => setDistricts(merge(fromVenues)))
      .catch(() => {
        // The built-in Istanbul list is enough without the server
      });
    return () => controller.abort();
  }, []);

  return districts;
}
