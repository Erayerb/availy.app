import { useEffect, useState } from 'react';

import { fetchDistricts } from '../lib/api';

export function useDistricts() {
  const [districts, setDistricts] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetchDistricts(controller.signal)
      .then(setDistricts)
      .catch(() => {
        // District chips are optional; "Tümü" still works without them
      });
    return () => controller.abort();
  }, []);

  return districts;
}
