/** v2 friends: user-name search, requests, QR code and invite link. */
import { send } from './accountApi.ts';
import { normalizeUsername } from './auth.ts';
import { WEB_APP_URL } from './share.ts';

export type Person = { id: number; username: string; name: string };
export type Relation = 'friend' | 'outgoing' | 'incoming' | 'none';
// A friend's newest public check-in: only the venue and the time, never a live location
export type FriendCheckin = { venue_id: number; venue_name: string; at: string; is_first: boolean; points: number };
export type Friend = Person & { last_checkin: FriendCheckin | null };
export type FriendLists = { friends: Friend[]; incoming: Person[]; outgoing: Person[] };

const QR_PREFIX = 'availy:friend:';

/** What my friend QR code contains. */
export const friendQrPayload = (username: string) => `${QR_PREFIX}${username}`;

/** Link that adds me as a friend when opened (web demo); also inside the shared message. */
export const inviteLink = (username: string) => `${WEB_APP_URL}?invite=${encodeURIComponent(username)}`;

// The SMS sent with "Davet et" from the contacts list
export const smsInviteMessage = (username: string) =>
  `Arkadaşın seni availy'ye davet ediyor. Sen de ilk check-in'i yap. ${inviteLink(username)}`;

export const inviteMessage = (username: string) => `availy'de beni arkadaş olarak ekle: @${username} ${inviteLink(username)}`;

const USERNAME = /^[a-z0-9][a-z0-9._]{2,19}$/;

/** User name from a scanned QR, an invite link or a typed "@name"; null if it is none of them. */
export function parseFriendCode(data: string): string | null {
  const text = data.trim();
  let candidate = text;
  if (text.toLowerCase().startsWith(QR_PREFIX)) candidate = text.slice(QR_PREFIX.length);
  else if (text.includes('invite=')) candidate = new URLSearchParams(text.slice(text.indexOf('?'))).get('invite') ?? '';
  const username = normalizeUsername(candidate);
  return USERNAME.test(username) ? username : null;
}

/** "?invite=eray" in the web address, if any. */
export function inviteFromQuery(search: string): string | null {
  const value = new URLSearchParams(search).get('invite');
  return value ? parseFriendCode(value) : null;
}

export const friendsApi = {
  search: (token: string, q: string) =>
    send<(Person & { relation: Relation })[]>('GET', `/v1/users/search?q=${encodeURIComponent(q)}`, undefined, token),
  list: (token: string) => send<FriendLists>('GET', '/v1/friends', undefined, token),
  add: (token: string, username: string) =>
    send<Person & { relation: Relation }>('POST', '/v1/friends', { username }, token),
  remove: (token: string, id: number) => send<void>('DELETE', `/v1/friends/${id}`, undefined, token),
  // "Rehberden bul": my number (kept only as a hash), then the contacts' numbers (compared, not stored)
  setPhone: (token: string, phone: string) => send<void>('PUT', '/v1/me/phone', { phone }, token),
  removePhone: (token: string) => send<void>('DELETE', '/v1/me/phone', undefined, token),
  // availy users among the contacts, each with the number it matched (as sent)
  // "👥 @ayse burada": friends who checked in at the venue in the last 90 minutes
  here: (token: string, venueId: number) =>
    send<{ username: string; at: string }[]>('GET', `/v1/venues/${venueId}/friends-here`, undefined, token),
  matchContacts: (token: string, phones: string[]) =>
    send<(Person & { relation: Relation; phone: string })[]>('POST', '/v1/friends/contacts', { phones }, token),
};
