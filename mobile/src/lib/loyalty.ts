/**
 * Loyalty: venues run either a stamp card ("5 kahveye 1 bedava") or a paid
 * membership (shown only; no payment), kept on the server (lib/loyaltyApi.ts).
 * Customers join the ones they want and also collect app-wide "availy puanı".
 */
export type LoyaltyProgram = {
  venueId: number;
  venueName: string;
  kind: 'stamps' | 'membership';
  stampsRequired: number; // stamps
  reward: string; // stamps: what you get
  price: number; // membership: ₺ per month
  perk: string; // membership: what members get
  active?: boolean; // paused programs are hidden from customers (missing = active)
  // The signed-in customer's card / membership, when they joined
  member?: { stamps: number; rewards: number; totalStamps: number } | null;
};

export const isProgramActive = (p: LoyaltyProgram) => p.active !== false;

export const POINTS_PER_STAMP = 5;
export const POINTS_PER_COUPON = 10;

export function validateProgram(p: Omit<LoyaltyProgram, 'venueId' | 'venueName'>): string | null {
  if (p.kind === 'stamps') {
    if (!Number.isInteger(p.stampsRequired) || p.stampsRequired < 2 || p.stampsRequired > 20)
      return 'Damga sayısı 2 ile 20 arasında olmalı.';
    if (p.reward.trim().length < 3) return 'Ödülü yaz (ör. 1 kahve bedava).';
  } else {
    if (!Number.isFinite(p.price) || p.price <= 0) return 'Aylık ücreti yaz.';
    if (p.perk.trim().length < 3) return 'Üyelere ne sunduğunu yaz (ör. her kahvede %15 indirim).';
  }
  return null;
}

export function describeProgram(p: LoyaltyProgram): string {
  return p.kind === 'stamps' ? `${p.stampsRequired} damga = ${p.reward}` : `₺${p.price}/ay · ${p.perk}`;
}

/** App-wide points from stamps collected and coupons used. */
export function availyPoints(totalStamps: number, couponsUsed: number): number {
  return totalStamps * POINTS_PER_STAMP + couponsUsed * POINTS_PER_COUPON;
}

const QR_PREFIX = 'availy:customer:';

/** What the customer's loyalty QR code contains. */
export const customerQrPayload = (code: string) => `${QR_PREFIX}${code}`;

/** Customer code from a scanned QR (or a code typed by hand); null if it is not ours. */
export function parseCustomerQr(data: string): string | null {
  const raw = data.trim().toUpperCase().startsWith(QR_PREFIX.toUpperCase()) ? data.trim().slice(QR_PREFIX.length) : data.trim();
  const code = raw.toUpperCase();
  return /^M-\d{6}$/.test(code) ? code : null;
}
