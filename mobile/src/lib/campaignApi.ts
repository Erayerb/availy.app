/** v2: campaigns and coupons on the server, in the shapes the screens already use. */
import { send } from './accountApi.ts';
import type { Campaign, NewCampaign } from './campaigns.ts';
import type { Coupon } from './coupons.ts';

type ServerCampaign = {
  id: number;
  venue_id: number;
  venue_name: string;
  lat: number;
  lon: number;
  message: string;
  discount: number | null;
  radius_km: number;
  max_claims: number | null;
  duration_hours: number;
  starts_at: string;
  ends_at: string;
  checkin_only?: boolean;
  claims: number;
  redemptions: number;
  views: number;
};

type ServerCoupon = {
  code: string;
  campaign_id: number;
  venue_id: number;
  venue_name: string;
  message: string;
  discount: number | null;
  claimed_at: string;
  redeemed_at: string | null;
  ends_at: string;
};

export const toCampaign = (c: ServerCampaign): Campaign => ({
  id: String(c.id),
  venueId: c.venue_id,
  venueName: c.venue_name,
  lat: c.lat,
  lon: c.lon,
  message: c.message,
  discount: c.discount,
  radiusKm: c.radius_km,
  maxClaims: c.max_claims,
  durationHours: c.duration_hours,
  startsAt: c.starts_at,
  endsAt: c.ends_at,
  stats: { views: c.views, claims: c.claims, redemptions: c.redemptions },
  checkinOnly: c.checkin_only ?? false,
});

export const toCoupon = (c: ServerCoupon): Coupon => ({
  code: c.code,
  campaignId: String(c.campaign_id),
  venueId: c.venue_id,
  venueName: c.venue_name,
  message: c.message,
  discount: c.discount,
  claimedAt: c.claimed_at,
  redeemedAt: c.redeemed_at,
  endsAt: c.ends_at,
});

export const campaignApi = {
  running: async () => (await send<ServerCampaign[]>('GET', '/v1/campaigns')).map(toCampaign),
  mine: async (token: string) => (await send<ServerCampaign[]>('GET', '/v1/me/campaigns', undefined, token)).map(toCampaign),
  create: async (token: string, c: NewCampaign) =>
    toCampaign(
      await send<ServerCampaign>(
        'POST',
        '/v1/campaigns',
        {
          message: c.message,
          discount: c.discount,
          radius_km: c.radiusKm,
          max_claims: c.maxClaims ?? null,
          duration_hours: c.durationHours,
          checkin_only: c.checkinOnly ?? false,
        },
        token,
      ),
    ),
  end: (token: string, id: string) => send<ServerCampaign>('POST', `/v1/campaigns/${id}/end`, undefined, token),
  hide: (token: string, ids: string[]) => send<void>('POST', '/v1/campaigns/hide', { ids: ids.map(Number) }, token),
  view: (token: string, id: string) => send<void>('POST', `/v1/campaigns/${id}/view`, undefined, token),
  claim: async (token: string, id: string) => toCoupon(await send<ServerCoupon>('POST', `/v1/campaigns/${id}/coupon`, undefined, token)),
  // A customer's coupons; for a business, those taken for its campaigns
  coupons: async (token: string) => (await send<ServerCoupon[]>('GET', '/v1/me/coupons', undefined, token)).map(toCoupon),
  redeem: async (token: string, code: string) =>
    toCoupon(await send<ServerCoupon>('POST', '/v1/coupons/redeem', { code }, token)),
};
