import type { Venue } from './api';
import { distanceKm } from './geo.ts';

export const MAX_ALTERNATIVE_KM = 2;
// An alternative must be clearly emptier (at least 10 points), and not crowded itself
const MIN_RATIO_GAP = 0.1;

/** Only crowded venues trigger the "quieter alternatives" pop-up. */
export const shouldSuggestAlternatives = (venue: Venue) => venue.occupancy.level === 'high';

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
    .filter((v) => v.occupancy.level !== 'high' && v.occupancy.ratio <= venue.occupancy.ratio - MIN_RATIO_GAP)
    .map((v) => ({ venue: v, distanceKm: distanceKm(venue, v), hasCampaign: campaignVenueIds.has(v.id) }))
    .filter((a) => a.distanceKm <= MAX_ALTERNATIVE_KM)
    .sort(
      (a, b) =>
        Number(b.hasCampaign) - Number(a.hasCampaign) ||
        Number(b.venue.occupancy.level === 'low') - Number(a.venue.occupancy.level === 'low') ||
        a.distanceKm - b.distanceKm,
    )
    .slice(0, limit);
}
