/**
 * Campaign coupons: a customer takes a code, shows it at the counter and the
 * business marks it used. Codes are made and checked on the server (lib/campaignApi.ts).
 */
import type { Campaign } from './campaigns.ts';

export type Coupon = {
  code: string; // e.g. "AV-7K3P"
  campaignId: string;
  venueId: number;
  venueName: string;
  message: string;
  discount: number | null;
  claimedAt: string;
  redeemedAt: string | null;
  endsAt: string; // the campaign's end: after it the coupon is no longer valid
};

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '');

const QR_PREFIX = 'availy:coupon:';

/** What the coupon's QR code contains. */
export const couponQrPayload = (code: string) => `${QR_PREFIX}${code}`;

/** Coupon code from a scanned QR (or a code typed by hand); null if it is not a coupon. */
export function parseCouponQr(data: string): string | null {
  const text = data.trim();
  const raw = text.toLowerCase().startsWith(QR_PREFIX) ? text.slice(QR_PREFIX.length) : text;
  const code = normalizeCode(raw);
  return /^AV-[A-Z0-9]{4}$/.test(code) ? code : null;
}

/** Coupons still available for a campaign with a limit (null = unlimited). */
export function remainingCoupons(campaign: Campaign): number | null {
  if (!campaign.maxClaims) return null;
  return Math.max(0, campaign.maxClaims - (campaign.stats?.claims ?? 0));
}

/** "Geçerli · kasada göster" while the campaign runs and the coupon is unused. */
export const couponValid = (coupon: Coupon, now: Date) =>
  coupon.redeemedAt === null && now.getTime() < new Date(coupon.endsAt).getTime();
