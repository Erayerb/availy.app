import type { Venue } from './api';
import { crowdRatioText, liveLevel } from './crowd.ts';
import { levelStyle } from './occupancy.ts';

// "Destek" in Daha fazla: the support page of the introduction website, once it exists (null: not yet)
export const SUPPORT_SITE_URL: string | null = null;

// v2 web demo (v1 stays at /availy.app/)
export const WEB_APP_URL = 'https://erayerb.github.io/availy.app/v2/';

/** Link to the web app that opens this venue (by name, which is unique). */
export const venueLink = (name: string) => `${WEB_APP_URL}?venue=${encodeURIComponent(name)}`;

export function shareMessage(venue: Venue): string {
  const level = liveLevel(venue);
  const ratio = venue.crowd ? crowdRatioText(venue.crowd) : null;
  const status = !venue.open_now
    ? `şu an kapalı, ${venue.opens_at}'de açılıyor`
    : level
      ? `şu an ${levelStyle(level).label.toLocaleLowerCase('tr-TR')}${ratio ? ` (${ratio})` : ''}`
      : 'için henüz güncel bildirim yok, ilk check-in\'i sen yap';
  return `${venue.name} ${status}. availy'de gör: ${venueLink(venue.name)}`;
}

/** "Arkadaşlarına paylaş" after a check-in: where I am and how full it is. */
export function checkinShareMessage(venueName: string, levelLabel: string, discovered: boolean, note = ''): string {
  const what = discovered ? `${venueName}'i ilk ben keşfettim ✨` : `${venueName}'deyim`;
  const words = note.trim() ? ` “${note.trim()}”` : '';
  return `📍 ${what} · şu an ${levelLabel.toLocaleLowerCase('tr-TR')}.${words} availy'de gel gör: ${venueLink(venueName)}`;
}

/** Venue name from a shared link (?venue=...), if any. */
export function venueFromQuery(search: string): string | null {
  const name = new URLSearchParams(search).get('venue');
  return name && name.trim() ? name.trim() : null;
}
