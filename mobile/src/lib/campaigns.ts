/**
 * Business campaigns ("next 2 hours, all coffees 20% off"), kept on the server (lib/campaignApi.ts);
 * users see active ones within the chosen radius.
 */
import { distanceKm, type LatLon } from './geo.ts';

export const RADIUS_OPTIONS_KM = [1, 2, 5] as const;
export const DURATION_OPTIONS_HOURS = [1, 2, 3] as const;
export const DISCOUNT_OPTIONS = [10, 20, 30] as const;
// How many customers may take a coupon (null = no limit)
export const CLAIM_LIMIT_OPTIONS = [10, 25, 50, 100] as const;
export const MAX_MESSAGE_LENGTH = 140;

export type Campaign = {
  id: string;
  venueId: number;
  venueName: string;
  lat: number;
  lon: number;
  message: string;
  discount: number | null; // percent, or null for a message without a discount
  radiusKm: number;
  maxClaims?: number | null; // coupon limit; missing or null = unlimited
  durationHours?: number; // planned length, reused by "Tekrar gönder" (missing in older data)
  startsAt: string; // ISO
  endsAt: string; // ISO; moved to "now" when the business ends it early
  // From the server: shown to how many people, coupons taken and used
  stats?: { views: number; claims: number; redemptions: number };
  checkinOnly?: boolean; // "Check-in yapana kupon": the coupon comes with a check-in there
};

export type NewCampaign = Omit<Campaign, 'id' | 'startsAt' | 'endsAt' | 'durationHours' | 'stats'> & { durationHours: number };

export function createCampaign(input: NewCampaign, now: Date, id: string): Campaign {
  const { durationHours } = input;
  return {
    ...input,
    message: input.message.trim(),
    id,
    startsAt: now.toISOString(),
    endsAt: new Date(now.getTime() + durationHours * 3_600_000).toISOString(),
  };
}

export function validateCampaign(message: string): string | null {
  const text = message.trim();
  if (text.length < 5) return 'Kampanya mesajını yaz.';
  if (text.length > MAX_MESSAGE_LENGTH) return `Mesaj en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir.`;
  return null;
}

export const isActive = (c: Campaign, now: Date) =>
  new Date(c.startsAt).getTime() <= now.getTime() && now.getTime() < new Date(c.endsAt).getTime();

/** Same campaign again, starting now ("Tekrar gönder"). */
export function repeatCampaign(c: Campaign): NewCampaign {
  const planned = c.durationHours ?? Math.round((new Date(c.endsAt).getTime() - new Date(c.startsAt).getTime()) / 3_600_000);
  return {
    venueId: c.venueId,
    venueName: c.venueName,
    lat: c.lat,
    lon: c.lon,
    message: c.message,
    discount: c.discount,
    radiusKm: c.radiusKm,
    maxClaims: c.maxClaims ?? null,
    checkinOnly: c.checkinOnly ?? false,
    durationHours: Math.min(Math.max(planned, 1), 24),
  };
}

export function endCampaign(c: Campaign, now: Date): Campaign {
  return { ...c, endsAt: now.toISOString() };
}

/** "1 sa 20 dk kaldı" / "15 dk kaldı" / "Bitti" */
export function timeLeft(c: Campaign, now: Date): string {
  const minutes = Math.ceil((new Date(c.endsAt).getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return 'Bitti';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} dk kaldı`;
  return m === 0 ? `${h} sa kaldı` : `${h} sa ${m} dk kaldı`;
}

/** Active campaigns whose radius reaches the user, nearest first. */
export function campaignsNear(campaigns: Campaign[], user: LatLon, now: Date) {
  return campaigns
    .filter((c) => isActive(c, now))
    .map((c) => ({ campaign: c, distanceKm: distanceKm(user, c) }))
    .filter(({ campaign, distanceKm: d }) => d <= campaign.radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * What a customer sees: with a known location, campaigns whose radius reaches
 * them; without one (no permission / outside the demo area), every active one.
 */
export function visibleCampaigns(campaigns: Campaign[], user: LatLon | null, now: Date) {
  if (user) return campaignsNear(campaigns, user, now);
  return campaigns
    .filter((c) => isActive(c, now))
    .map((c) => ({ campaign: c, distanceKm: null as number | null }));
}

export function activeCampaignForVenue(campaigns: Campaign[], venueId: number, now: Date) {
  return campaigns.find((c) => c.venueId === venueId && isActive(c, now)) ?? null;
}

const SUGGESTED_ITEMS: Record<string, string> = {
  cafe: 'tüm kahvelerde',
  bar: 'tüm içeceklerde',
  restaurant: 'tüm menüde',
  coworking: 'günlük masa ücretinde',
  library: 'kafeteryada',
  park: 'büfede',
};

/** Ready-made "dead hour" campaign, as in the B2B scenario: one tap to send. */
export function deadHourSuggestion(category: string, discount = 20, hours = 2): string {
  const items = SUGGESTED_ITEMS[category] ?? 'tüm siparişlerde';
  return `Şu an çok sayıda boş yerimiz var! Önümüzdeki ${hours} saat ${items} %${discount} indirim.`;
}

export function parseCampaigns(raw: unknown): Campaign[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is Campaign =>
      c && typeof c.id === 'string' && Number.isInteger(c.venueId) && typeof c.endsAt === 'string',
  );
}
