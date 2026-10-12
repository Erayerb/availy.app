/**
 * Loyalty: venues run either a stamp card ("5 kahveye 1 bedava") or a paid
 * membership (shown only; no payment). Customers also collect app-wide
 * "availy puanı". Prototype: stored on this phone only.
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
};

export const isProgramActive = (p: LoyaltyProgram) => p.active !== false;

export type StampCard = { venueId: number; userKey: string; stamps: number; rewardsAvailable: number };

export type Membership = { venueId: number; userKey: string; since: string };

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

/** Add one stamp; a full card turns into a reward and starts again. */
export function addStamp(
  cards: StampCard[],
  program: LoyaltyProgram,
  userKey: string,
): { cards: StampCard[]; card: StampCard } {
  const current = cards.find((c) => c.venueId === program.venueId && c.userKey === userKey) ?? {
    venueId: program.venueId,
    userKey,
    stamps: 0,
    rewardsAvailable: 0,
  };
  const stamps = current.stamps + 1;
  const card =
    stamps >= program.stampsRequired
      ? { ...current, stamps: 0, rewardsAvailable: current.rewardsAvailable + 1 }
      : { ...current, stamps };
  const rest = cards.filter((c) => c !== current && !(c.venueId === card.venueId && c.userKey === userKey));
  return { cards: [card, ...rest], card };
}

export function useReward(cards: StampCard[], venueId: number, userKey: string) {
  const card = cards.find((c) => c.venueId === venueId && c.userKey === userKey);
  if (!card || card.rewardsAvailable === 0) return { cards, error: 'Kullanılacak ödül yok.' };
  return {
    cards: cards.map((c) => (c === card ? { ...c, rewardsAvailable: c.rewardsAvailable - 1 } : c)),
    error: null,
  };
}

/** Short code a customer shows at the counter so the business can give a stamp. */
export function customerCode(userKey: string): string {
  let h = 2166136261;
  for (let i = 0; i < userKey.length; i++) {
    h ^= userKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `M-${((h >>> 0) % 1_000_000).toString().padStart(6, '0')}`;
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
