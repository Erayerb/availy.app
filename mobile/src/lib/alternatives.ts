import type { Venue } from './api';
import { crowdScore, liveLevel } from './crowd.ts';
import { distanceKm } from './geo.ts';

export const MAX_ALTERNATIVE_KM = 2;
// An alternative must be clearly emptier (at least 10 points), not crowded, and have fresh check-ins
const MIN_RATIO_GAP = 0.1;

/** Only venues reported crowded trigger the "quieter alternatives" pop-up. */
export const shouldSuggestAlternatives = (venue: Venue) => liveLevel(venue) === 'high';

/**
 * Venues of the same kind nearby that are clearly emptier by fresh
 * check-ins, then the open similar ones nobody reported lately (`known: false`: maybe empty, nobody
 * knows; most venues are like this while availy is young). Order: a campaign that reaches the user,
 * known before unknown, "Sakin" first, then by distance.
 */
export function quieterAlternatives(
  venue: Venue,
  all: Venue[],
  campaignVenueIds: ReadonlySet<number> = new Set(),
  limit = Infinity,
) {
  return all
    .filter((v) => v.id !== venue.id && v.open_now !== false)
    // The same kind only: a café's alternatives are cafés
    .filter((v) => v.category === venue.category)
    .filter((v) => {
      const level = liveLevel(v);
      return level === null || (level !== 'high' && crowdScore(v) <= crowdScore(venue) - MIN_RATIO_GAP);
    })
    .map((v) => ({
      venue: v,
      distanceKm: distanceKm(venue, v),
      hasCampaign: campaignVenueIds.has(v.id),
      known: liveLevel(v) !== null,
    }))
    .filter((a) => a.distanceKm <= MAX_ALTERNATIVE_KM)
    .sort(
      (a, b) =>
        Number(b.hasCampaign) - Number(a.hasCampaign) ||
        Number(b.known) - Number(a.known) ||
        Number(liveLevel(b.venue) === 'low') - Number(liveLevel(a.venue) === 'low') ||
        a.distanceKm - b.distanceKm,
    )
    .slice(0, limit);
}
