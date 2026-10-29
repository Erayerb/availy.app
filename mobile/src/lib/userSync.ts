/** v2: favorites, "Sakin olunca haber ver" watches and settings kept per account on the server. */
import { send } from './accountApi';

export type ServerWatch = { venue_id: number; venue_name: string; created_at: string };

export const userSyncApi = {
  favorites: (token: string) => send<number[]>('GET', '/v1/me/favorites', undefined, token),
  setFavorite: (token: string, venueId: number, on: boolean) =>
    send<void>(on ? 'PUT' : 'DELETE', `/v1/me/favorites/${venueId}`, undefined, token),
  watches: (token: string) => send<ServerWatch[]>('GET', '/v1/me/watches', undefined, token),
  addWatch: (token: string, venueId: number, createdAt?: string) =>
    send<void>('PUT', `/v1/me/watches/${venueId}`, { created_at: createdAt ?? null }, token),
  removeWatch: (token: string, venueId: number) => send<void>('DELETE', `/v1/me/watches/${venueId}`, undefined, token),
  settings: (token: string) => send<Record<string, unknown> | null>('GET', '/v1/me/settings', undefined, token),
  saveSettings: (token: string, settings: object) => send<void>('PUT', '/v1/me/settings', settings, token),
};

/** Ids on the phone that the server does not have yet (uploaded once, the first time an account syncs). */
export const notOnServer = (local: number[], server: number[]) => local.filter((id) => !server.includes(id));
