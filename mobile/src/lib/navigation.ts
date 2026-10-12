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
