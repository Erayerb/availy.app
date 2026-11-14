/** "Sponsorlu mekan": shown first on the home page for a paid period (an admin switches it on for now). */
import { send } from './accountApi.ts';

export type SponsorStatus = {
  active: { starts_at: string; ends_at: string } | null;
  requested_days: 7 | 30 | null;
  views: number;
  taps: number;
  checkins: number;
};
export type SponsorOverview = {
  requests: { venue_id: number; venue_name: string; days: number; created_at: string }[];
  active: { venue_id: number; venue_name: string; ends_at: string }[];
};

// A view is counted once per venue while the app is open
const viewed = new Set<number>();

export const sponsorsApi = {
  view: (venueId: number) => {
    if (viewed.has(venueId)) return;
    viewed.add(venueId);
    send<void>('POST', `/v1/venues/${venueId}/sponsor-events`, { kind: 'view' }).catch(() => {});
  },
  tap: (venueId: number) => send<void>('POST', `/v1/venues/${venueId}/sponsor-events`, { kind: 'tap' }).catch(() => {}),
  status: (token: string) => send<SponsorStatus>('GET', '/v1/business/sponsorship', undefined, token),
  request: (token: string, days: 7 | 30) => send<SponsorStatus>('POST', '/v1/business/sponsorship', { days }, token),
  overview: (token: string) => send<SponsorOverview>('GET', '/v1/admin/sponsorships', undefined, token),
  start: (token: string, venueId: number, days: 7 | 30) => send<void>('POST', `/v1/admin/sponsorships/${venueId}`, { days }, token),
  stop: (token: string, venueId: number) => send<void>('DELETE', `/v1/admin/sponsorships/${venueId}`, undefined, token),
};

/** Sponsored open places first; the rest keep their order. */
export function sponsoredFirst<T extends { sponsored?: boolean; open_now: boolean }>(venues: T[]): T[] {
  const first = venues.filter((v) => v.sponsored && v.open_now);
  return first.length ? [...first, ...venues.filter((v) => !(v.sponsored && v.open_now))] : venues;
}
