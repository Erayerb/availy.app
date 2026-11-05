/** Tiny screen history so "back" returns to wherever the user came from. */
export type History<S> = { current: S; stack: S[] };

const MAX_DEPTH = 20;

export function push<S>(history: History<S>, next: S): History<S> {
  if (next === history.current) return history;
  return { current: next, stack: [...history.stack, history.current].slice(-MAX_DEPTH) };
}

export function back<S>(history: History<S>, fallback: S): History<S> {
  const previous = history.stack[history.stack.length - 1];
  return previous === undefined
    ? { current: fallback, stack: [] }
    : { current: previous, stack: history.stack.slice(0, -1) };
}

/** Pages kept open behind the current one; older ones open again when the user gets back to them. */
export const MAX_KEPT_PAGES = 5;

/** Which pages stay mounted: the tabs visited so far (one each) and the latest of the history. */
export function openPages<R extends { name: string; id: number }>(
  history: History<R>,
  tabNames: readonly string[],
  visitedTabs: readonly string[],
): { key: string; route: R }[] {
  const keyOf = (route: R) => (tabNames.includes(route.name) ? `tab:${route.name}` : `page:${route.id}`);
  const pages = new Map<string, R>();
  for (const route of [...history.stack.slice(-MAX_KEPT_PAGES), history.current]) pages.set(keyOf(route), route);
  for (const name of visitedTabs) {
    if (tabNames.includes(name) && !pages.has(`tab:${name}`)) pages.set(`tab:${name}`, { name, id: 0 } as R);
  }
  return [...pages].map(([key, route]) => ({ key, route }));
}
