/** One-time tip bubbles: each shows once (until "Anladım"), one at a time on the whole screen, where several wait
 * in order. */
import { useEffect, useState } from 'react';

import { KEYS, loadJson, saveJson } from './storage.ts';

export type TipId = 'mapColors' | 'checkinButton' | 'watchBell' | 'rewardPoints' | 'social' | 'campaignsButton' | 'pointsCard' | 'couponsTab' | 'homeSearch' | 'homeRows' | 'mapSearch' | 'addVenue';

let seen: Set<TipId> | null = null;
const listeners = new Set<() => void>();
const loading = loadJson<TipId[]>(KEYS.tipsSeen).then((list) => {
  seen = new Set(list ?? []);
  listeners.forEach((l) => l());
});

function notify(): void {
  listeners.forEach((l) => l());
}

export function markTipSeen(id: TipId): void {
  if (!seen) return;
  seen.add(id);
  saveJson(KEYS.tipsSeen, [...seen]);
  notify();
}

function useListen(): number {
  const [n, tick] = useState(0);
  useEffect(() => {
    const listener = () => tick((x) => x + 1);
    listeners.add(listener);
    loading.then(listener); // seen may load between the first render and this
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return n;
}

// The one tip on screen now (others wait for it to close), and how many other layers are open over the pages
// (a monthly summary, a badge celebration, a sheet): no tip comes over them
let current: TipId | null = null;
let holds = 0;

/** Whether this tip may show now: it wants to (`want`), nothing is open over the page and no other tip is on. */
export function useTipTurn(id: TipId, want: boolean): boolean {
  const n = useListen();
  useEffect(() => {
    if (want && holds === 0 && current === null) {
      current = id;
      notify();
    } else if ((!want || holds > 0) && current === id) {
      current = null;
      notify();
    }
  }, [want, n, id]);
  useEffect(
    () => () => {
      if (current === id) {
        current = null;
        notify();
      }
    },
    [id],
  );
  return want && holds === 0 && current === id;
}

/** A layer over the pages (sheet, popup) is open: tips wait until it closes. */
export function useHoldTips(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    holds += 1;
    notify();
    return () => {
      holds -= 1;
      notify();
    };
  }, [open]);
}

/** Whether the tip should show now: not seen yet, and the one it waits for (`after`) is closed. */
export function useTip(id: TipId, after?: TipId): boolean {
  useListen();
  if (!seen) return false;
  return !seen.has(id) && (!after || seen.has(after));
}
