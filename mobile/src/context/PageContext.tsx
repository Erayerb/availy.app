import { createContext, useContext, useEffect, useRef, type RefObject } from 'react';

/** Pages stay open under the one on top. What a page needs to know about that. */
export const PageContext = createContext({ focused: true, topTick: 0 });

/** A ref that says whether the page is on top: timers skip their work under another page. */
export function usePageFocused(): RefObject<boolean> {
  const { focused } = useContext(PageContext);
  const ref = useRef(focused);
  ref.current = focused;
  return ref;
}

/** Runs when the user comes back to this page (not the first time it opens): its data may be old. */
export function useOnPageFocus(refresh: () => unknown): void {
  const { focused } = useContext(PageContext);
  const was = useRef(focused);
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    if (focused && !was.current) latest.current();
    was.current = focused;
  }, [focused]);
}

/** Tapping the tab of the page already open: the list given this ref goes back to the top. */
export function usePageTop() {
  // A ScrollView or a FlatList
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = useRef<any>(null);
  const { topTick } = useContext(PageContext);
  useEffect(() => {
    if (topTick === 0) return;
    if (list.current?.scrollToOffset) list.current.scrollToOffset({ offset: 0, animated: true });
    else list.current?.scrollTo?.({ y: 0, animated: true });
  }, [topTick]);
  return list;
}
