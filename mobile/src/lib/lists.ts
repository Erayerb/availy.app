/** v2 venue lists ("Kadıköy'de ders çalışılacak yerler"): Favoriler > Listelerim, shared with friends or by link. */
import { send } from './accountApi.ts';
import { WEB_APP_URL } from './share.ts';

export const MAX_LIST_NAME = 40;

export type Visibility = 'private' | 'friends' | 'link';

export type VenueList = {
  id: number;
  name: string;
  visibility: Visibility;
  share_code: string | null; // only on my own lists
  owner: string | null;
  mine: boolean;
  venue_ids: number[]; // newest first
};

export const VISIBILITY_OPTIONS: { id: Visibility; label: string; hint: string }[] = [
  { id: 'private', label: 'Gizli', hint: 'Yalnızca sen görürsün.' },
  { id: 'friends', label: 'Arkadaşlar', hint: 'Arkadaşların profilinde görür.' },
  { id: 'link', label: 'Bağlantıyla herkes', hint: 'Arkadaşların görür; bağlantıyı gönderdiğin herkes de açabilir.' },
];

export const listsApi = {
  mine: (token: string) => send<VenueList[]>('GET', '/v1/lists', undefined, token),
  get: (token: string, id: number) => send<VenueList>('GET', `/v1/lists/${id}`, undefined, token),
  byCode: (token: string, code: string) => send<VenueList>('GET', `/v1/lists/shared/${encodeURIComponent(code)}`, undefined, token),
  ofUser: (token: string, username: string) => send<VenueList[]>('GET', `/v1/users/${encodeURIComponent(username)}/lists`, undefined, token),
  create: (token: string, name: string, visibility: Visibility, venueIds: number[] = []) =>
    send<VenueList>('POST', '/v1/lists', { name, visibility, venue_ids: venueIds }, token),
  update: (token: string, id: number, patch: { name?: string; visibility?: Visibility }) =>
    send<VenueList>('PATCH', `/v1/lists/${id}`, patch, token),
  remove: (token: string, id: number) => send<void>('DELETE', `/v1/lists/${id}`, undefined, token),
  // Adds the venue (present) or takes it out
  setVenue: (token: string, id: number, venueId: number, present: boolean) =>
    send<VenueList>('PUT', `/v1/lists/${id}/venues/${venueId}`, { present }, token),
  // "Listeyi kaydet": my private copy
  saveCopy: (token: string, id: number, code?: string | null) =>
    send<VenueList>('POST', `/v1/lists/${id}/save${code ? `?code=${encodeURIComponent(code)}` : ''}`, undefined, token),
};

/** The web link that opens a list shared by link. */
export const listLink = (code: string) => `${WEB_APP_URL}?list=${encodeURIComponent(code)}`;

export const listShareMessage = (name: string, code: string) => `availy'de "${name}" listeme bak: ${listLink(code)}`;

/** "?list=ABCD2345" in the web address, if any. */
export function listCodeFromQuery(search: string): string | null {
  const value = new URLSearchParams(search).get('list');
  return value && /^[A-Za-z0-9]{4,16}$/.test(value) ? value.toUpperCase() : null;
}
