/** "Venues changed" (one added, a check-in): pages kept open behind others load again instead of waiting for their timer. */
const listeners = new Set<() => void>();

export function notifyVenuesChanged(): void {
  listeners.forEach((listen) => listen());
}

export function onVenuesChanged(listen: () => void): () => void {
  listeners.add(listen);
  return () => listeners.delete(listen);
}
