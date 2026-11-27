/** v2 friends: user-name search, requests, QR code and invite link. */
import { send } from './accountApi.ts';
import { normalizeUsername } from './auth.ts';
import { WEB_APP_URL } from './share.ts';

export type Person = { id: number; username: string; name: string };
export type Relation = 'friend' | 'outgoing' | 'incoming' | 'none';
// A friend's newest public check-in: only the venue and the time, never a live location
export type FriendCheckin = { venue_id: number; venue_name: string; at: string; is_first: boolean; points: number };
export type Friend = Person & {
  last_checkin: FriendCheckin | null;
  streak?: number; // "🔥 4": days in a row with a check-in
  at_risk?: boolean; // no check-in today yet: the streak ends tonight
  can_save?: boolean; // I may save it ("Seri kurtarma", 2 a month, availo+ 10)
};
export type FriendLists = { friends: Friend[]; incoming: Person[]; outgoing: Person[] };

const QR_PREFIX = 'availy:friend:';

/** What my friend QR code contains. */
export const friendQrPayload = (username: string) => `${QR_PREFIX}${username}`;

/** Link that adds me as a friend when opened (web demo); also inside the shared message. */
export const inviteLink = (username: string) => `${WEB_APP_URL}?invite=${encodeURIComponent(username)}`;

export const inviteMessage = (username: string) =>
  `availo'da beni arkadaş olarak ekle: @${username}. Katılıp ilk check-in'ini yapınca ikimize de 50 puan. ${inviteLink(username)}`;

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
  // Seri kurtarma: cover a friend's day without a check-in (2 a month, availo+ 10)
  saveStreak: (token: string, username: string) =>
    send<{ username: string; streak: number }>('POST', `/v1/friends/${encodeURIComponent(username)}/save-streak`, undefined, token),
  // "👥 @ayse burada": friends who checked in at the venue in the last 90 minutes
  here: (token: string, venueId: number) =>
    send<{ username: string; at: string }[]>('GET', `/v1/venues/${venueId}/friends-here`, undefined, token),
  // "müdavim": the most check-ins here in the last 30 days (3+), among me, my friends and
  // people who show it to everyone
  regular: (token: string, venueId: number) =>
    send<{ username: string; visits: number; me: boolean; friend: boolean } | null>(
      'GET',
      `/v1/venues/${venueId}/regular`,
      undefined,
      token,
    ),
};

// Only fresh visits; an old one says little about where to go now
const RECENT_DAYS = 2;
const MAX_PLACES = 10;

export type FriendPlace = { venueId: number; at: string; people: Friend[] };

/** Places friends checked in to lately, newest first; one card per place. */
export function placesFromFriends(friends: Friend[], now: Date): FriendPlace[] {
  const since = now.getTime() - RECENT_DAYS * 86_400_000;
  const byVenue = new Map<number, FriendPlace>();
  for (const friend of friends) {
    const visit = friend.last_checkin;
    if (!visit || new Date(visit.at).getTime() < since) continue;
    const place = byVenue.get(visit.venue_id);
    if (!place) byVenue.set(visit.venue_id, { venueId: visit.venue_id, at: visit.at, people: [friend] });
    else {
      place.people.push(friend);
      if (visit.at > place.at) place.at = visit.at;
    }
  }
  return [...byVenue.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_PLACES);
}


// A friend "is there" for an hour after their (shared) check-in, like the venue page's "burada"
export const HERE_MINUTES = 60;

/** Friends at each venue now (checked in there within the hour), latest first: the venue cards' photos. */
export function friendsHereByVenue(friends: Friend[], now: number): Map<number, Friend[]> {
  const since = now - HERE_MINUTES * 60_000;
  const map = new Map<number, Friend[]>();
  for (const friend of friends) {
    const visit = friend.last_checkin;
    if (!visit || new Date(visit.at).getTime() < since) continue;
    map.set(visit.venue_id, [...(map.get(visit.venue_id) ?? []), friend]);
  }
  for (const list of map.values()) list.sort((a, b) => (b.last_checkin?.at ?? '').localeCompare(a.last_checkin?.at ?? ''));
  return map;
}
