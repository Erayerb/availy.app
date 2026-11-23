/** One-time tip bubbles: each shows once (until "Anladım"), one at a time where several wait in order. */
import { useEffect, useState } from 'react';

import { KEYS, loadJson, saveJson } from './storage.ts';

export type TipId = 'mapColors' | 'checkinButton' | 'watchBell' | 'rewardPoints' | 'social' | 'campaignsButton' | 'pointsCard' | 'couponsTab';

let seen: Set<TipId> | null = null;
const listeners = new Set<() => void>();
const loading = loadJson<TipId[]>(KEYS.tipsSeen).then((list) => {
  seen = new Set(list ?? []);
  listeners.forEach((l) => l());
});

export function markTipSeen(id: TipId): void {
  if (!seen) return;
  seen.add(id);
  saveJson(KEYS.tipsSeen, [...seen]);
  listeners.forEach((l) => l());
}

/** Whether the tip should show now: not seen yet, and the one it waits for (`after`) is closed. */
export function useTip(id: TipId, after?: TipId): boolean {
  const [, tick] = useState(0);
  useEffect(() => {
    const listener = () => tick((n) => n + 1);
    listeners.add(listener);
    loading.then(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  if (!seen) return false;
  return !seen.has(id) && (!after || seen.has(after));
}
