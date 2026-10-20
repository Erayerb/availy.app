import type { Venue } from './api';
import { crowdScore, liveLevel } from './crowd.ts';
import { distanceKm } from './geo.ts';

export const MAX_ALTERNATIVE_KM = 2;
// An alternative must be clearly emptier (at least 10 points), not crowded, and have fresh check-ins
const MIN_RATIO_GAP = 0.1;

/** Only venues reported crowded trigger the "quieter alternatives" pop-up. */
export const shouldSuggestAlternatives = (venue: Venue) => liveLevel(venue) === 'high';

/**
 * Similar venues nearby (same category or a shared purpose tag) that are
 * clearly emptier. Order: venues with a campaign that reaches the user first,
 * then "Sakin" ones, then by distance.
 */
export function quieterAlternatives(
  venue: Venue,
  all: Venue[],
  campaignVenueIds: ReadonlySet<number> = new Set(),
  limit = Infinity,
) {
  return all
    .filter((v) => v.id !== venue.id && v.open_now !== false)
    .filter((v) => v.category === venue.category || v.tags.some((t) => venue.tags.includes(t)))
    .filter((v) => {
      const level = liveLevel(v);
      return level !== null && level !== 'high' && crowdScore(v) <= crowdScore(venue) - MIN_RATIO_GAP;
    })
    .map((v) => ({ venue: v, distanceKm: distanceKm(venue, v), hasCampaign: campaignVenueIds.has(v.id) }))
    .filter((a) => a.distanceKm <= MAX_ALTERNATIVE_KM)
    .sort(
      (a, b) =>
        Number(b.hasCampaign) - Number(a.hasCampaign) ||
        Number(liveLevel(b.venue) === 'low') - Number(liveLevel(a.venue) === 'low') ||
        a.distanceKm - b.distanceKm,
    )
    .slice(0, limit);
}
