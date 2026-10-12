import { useCallback, useEffect, useState } from 'react';

import { loadJson, saveJson } from '../lib/storage';

/** State saved on the device under `key`; `parse` cleans up whatever was stored. */
export function usePersistentState<T>(key: string, initial: T, parse: (raw: unknown) => T) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    loadJson<unknown>(key).then((raw) => {
      if (raw !== null) setValue(parse(raw));
    });
    // Load once per key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (change: (current: T) => T) => {
      setValue((current) => {
        const next = change(current);
        saveJson(key, next);
        return next;
      });
    },
    [key],
  );

  return [value, update] as const;
}
