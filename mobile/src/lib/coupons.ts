/**
 * Campaign coupons: a customer claims a code, shows it at the counter and the
 * business marks it used. Prototype: stored on this phone only.
 */
import type { Campaign } from './campaigns.ts';

export type Coupon = {
  code: string; // e.g. "AV-7K3P"
  campaignId: string;
  venueId: number;
  venueName: string;
  message: string;
  discount: number | null;
  userKey: string; // account email, or "guest"
  claimedAt: string;
  redeemedAt: string | null;
};

// No 0/O or 1/I so codes are easy to read aloud
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function couponCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < 4; i++) code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return `AV-${code}`;
}

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '');

/** Coupons still available for a campaign with a limit (null = unlimited). */
export function remainingCoupons(campaign: Campaign, coupons: Coupon[]): number | null {
  if (!campaign.maxClaims) return null;
  return Math.max(0, campaign.maxClaims - coupons.filter((c) => c.campaignId === campaign.id).length);
}

/** One coupon per campaign and customer; claiming again returns the same code. */
export function claimCoupon(
  coupons: Coupon[],
  campaign: Campaign,
  userKey: string,
  now: Date,
  code: string,
): { coupons: Coupon[]; coupon: Coupon; error: null } | { coupons: Coupon[]; coupon: null; error: string } {
  const existing = coupons.find((c) => c.campaignId === campaign.id && c.userKey === userKey);
  if (existing) return { coupons, coupon: existing, error: null };
  if (remainingCoupons(campaign, coupons) === 0) return { coupons, coupon: null, error: 'Bu kampanyanın kupon sınırı doldu.' };
  const coupon: Coupon = {
    code,
    campaignId: campaign.id,
    venueId: campaign.venueId,
    venueName: campaign.venueName,
    message: campaign.message,
    discount: campaign.discount,
    userKey,
    claimedAt: now.toISOString(),
    redeemedAt: null,
  };
  return { coupons: [coupon, ...coupons], coupon, error: null };
}

/** Business side: mark a coupon used at its own venue. */
export function redeemCoupon(coupons: Coupon[], rawCode: string, venueId: number, now: Date) {
  const code = normalizeCode(rawCode);
  const coupon = coupons.find((c) => c.code === code);
  if (!coupon) return { coupons, error: 'Bu kod bulunamadı.' };
  if (coupon.venueId !== venueId) return { coupons, error: 'Bu kod başka bir mekana ait.' };
  if (coupon.redeemedAt) return { coupons, error: 'Bu kod zaten kullanılmış.' };
  const redeemed = { ...coupon, redeemedAt: now.toISOString() };
  return { coupons: coupons.map((c) => (c.code === code ? redeemed : c)), error: null, coupon: redeemed };
}

/** Funnel for one campaign: shown to customers -> coupon claimed -> used at the venue. */
export function campaignStats(campaignId: string, views: Record<string, number>, coupons: Coupon[]) {
  const claimed = coupons.filter((c) => c.campaignId === campaignId);
  return {
    views: views[campaignId] ?? 0,
    claims: claimed.length,
    redemptions: claimed.filter((c) => c.redeemedAt).length,
  };
}

export function parseCoupons(raw: unknown): Coupon[] {
  return Array.isArray(raw)
    ? raw.filter((c) => c && typeof c.code === 'string' && typeof c.campaignId === 'string')
    : [];
}
