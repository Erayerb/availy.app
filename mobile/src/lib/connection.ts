/** Whether the server answered lately: every request reports here, the "İnternet yok" bar listens. */
let online = true;
const listeners = new Set<(online: boolean) => void>();

export function reportConnection(ok: boolean): void {
  if (ok === online) return;
  online = ok;
  listeners.forEach((listen) => listen(ok));
}

export const isOnline = () => online;

export function onConnectionChange(listen: (online: boolean) => void): () => void {
  listeners.add(listen);
  return () => listeners.delete(listen);
}
