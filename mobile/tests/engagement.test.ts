import assert from 'node:assert/strict';
import { test } from 'node:test';

import { amenitiesFor } from '../src/lib/amenities.ts';
import { createCampaign } from '../src/lib/campaigns.ts';
import { campaignStats, claimCoupon, couponCode, normalizeCode, redeemCoupon, remainingCoupons } from '../src/lib/coupons.ts';
import {
  addStamp,
  availyPoints,
  customerCode,
  customerQrPayload,
  parseCustomerQr,
  describeProgram,
  useReward,
  validateProgram,
  type LoyaltyProgram,
} from '../src/lib/loyalty.ts';
import { levelStyle } from '../src/lib/occupancy.ts';
import { shareMessage, venueFromQuery, venueLink } from '../src/lib/share.ts';
import { byQuietest, sortVenues } from '../src/lib/sort.ts';
import { canWatch, notificationText, toggleWatch, watchTriggered } from '../src/lib/watch.ts';

const NOW = new Date('2026-10-13T10:00:00Z');
const campaign = createCampaign(
  { venueId: 7, venueName: 'Demo Kafe Moda', lat: 40.98, lon: 29.02, message: 'Kahveler %20', discount: 20, radiusKm: 2, durationHours: 2 },
  NOW,
  'camp-1',
);

const venue = (over: Record<string, unknown>) =>
  ({
    id: 1, name: 'Demo Kafe Moda', category: 'cafe', tags: ['socializing'], lat: 40.984, lon: 29.026,
    open_now: true, hours: '08:00–23:00', opens_at: '08:00',
    crowd: { state: 'live', level: 'medium', ratio: 0.4, reporters: 3, last_report_at: '', queue: null, seats: null },
    ...over,
  }) as never;

test('coupon codes are readable and one per customer per campaign', () => {
  const code = couponCode(() => 0);
  assert.equal(code, 'AV-AAAA');
  assert.match(couponCode(), /^AV-[A-HJ-NP-Z2-9]{4}$/);
  const first = claimCoupon([], campaign, 'eray@x.com', NOW, 'AV-1111');
  const again = claimCoupon(first.coupons, campaign, 'eray@x.com', NOW, 'AV-2222');
  assert.equal(again.coupon?.code, 'AV-1111');
  assert.equal(again.coupons.length, 1);
  assert.equal(normalizeCode(' av-11 11 '), 'AV-1111');
});

test('business redeems a coupon once, only at its own venue', () => {
  const { coupons } = claimCoupon([], campaign, 'eray@x.com', NOW, 'AV-1111');
  assert.equal(redeemCoupon(coupons, 'av-1111', 99, NOW).error, 'Bu kod başka bir mekana ait.');
  assert.equal(redeemCoupon(coupons, 'AV-9999', 7, NOW).error, 'Bu kod bulunamadı.');
  const ok = redeemCoupon(coupons, 'av-1111', 7, NOW);
  assert.equal(ok.error, null);
  assert.equal(redeemCoupon(ok.coupons, 'AV-1111', 7, NOW).error, 'Bu kod zaten kullanılmış.');
  assert.deepEqual(campaignStats('camp-1', { 'camp-1': 12 }, ok.coupons), { views: 12, claims: 1, redemptions: 1 });
});

const stampProgram: LoyaltyProgram = {
  venueId: 7, venueName: 'Demo Kafe Moda', kind: 'stamps', stampsRequired: 5, reward: '1 kahve bedava', price: 0, perk: '',
};

test('stamp card: the fifth stamp becomes a free coffee', () => {
  let cards = [] as ReturnType<typeof addStamp>['cards'];
  for (let i = 0; i < 4; i++) cards = addStamp(cards, stampProgram, 'u').cards;
  assert.equal(cards[0].stamps, 4);
  const full = addStamp(cards, stampProgram, 'u');
  assert.deepEqual([full.card.stamps, full.card.rewardsAvailable, full.cards.length], [0, 1, 1]);
  const used = useReward(full.cards, 7, 'u');
  assert.equal(used.error, null);
  assert.equal(used.cards[0].rewardsAvailable, 0);
  assert.equal(useReward(used.cards, 7, 'u').error, 'Kullanılacak ödül yok.');
});

test('loyalty programs: validation, description, codes and points', () => {
  assert.equal(validateProgram({ ...stampProgram, stampsRequired: 1 }), 'Damga sayısı 2 ile 20 arasında olmalı.');
  assert.equal(validateProgram(stampProgram), null);
  const membership = { ...stampProgram, kind: 'membership' as const, price: 149, perk: 'her kahvede %15 indirim' };
  assert.equal(validateProgram(membership), null);
  assert.equal(validateProgram({ ...membership, price: 0 }), 'Aylık ücreti yaz.');
  assert.equal(describeProgram(stampProgram), '5 damga = 1 kahve bedava');
  assert.equal(describeProgram(membership), '₺149/ay · her kahvede %15 indirim');
  assert.match(customerCode('eray@x.com'), /^M-\d{6}$/);
  assert.equal(customerCode('eray@x.com'), customerCode('eray@x.com'));
  assert.equal(availyPoints(3, 2), 35);
});

const live = (level: string, ratio: number | null = null) => ({
  crowd: { state: 'live', level, ratio, reporters: 1, last_report_at: '', queue: null, seats: null },
});

test('"Sakin olunca haber ver": offered for Orta / Kalabalık, fires when check-ins say Sakin', () => {
  assert.ok(canWatch(venue(live('high'))));
  assert.ok(canWatch(venue(live('medium'))));
  assert.ok(!canWatch(venue(live('low'))));
  assert.ok(!canWatch(venue({ crowd: { state: 'unexplored' } })));
  assert.ok(watchTriggered(venue(live('low'))));
  assert.ok(!watchTriggered(venue({ open_now: false, ...live('low') })));
  assert.ok(!watchTriggered(venue({ crowd: { state: 'stale' } })));
  const on = toggleWatch([], { id: 1, name: 'X' }, NOW);
  assert.equal(on.length, 1);
  assert.equal(toggleWatch(on, { id: 1, name: 'X' }, NOW).length, 0);
  assert.equal(notificationText(venue(live('low'))).title, 'Demo Kafe Moda sakinleşti');
});

test('sorting: quietest puts open, emptier venues first; no fresh check-ins after them', () => {
  const list = [
    venue({ id: 1, ...live('medium', 0.5) }),
    venue({ id: 2, open_now: false, ...live('low', 0.1) }),
    venue({ id: 3, ...live('low') }), // no ratio: Sakin counts as 0.2
    venue({ id: 4, crowd: { state: 'unexplored' } }),
  ];
  assert.deepEqual(byQuietest(list).map((v: { id: number }) => v.id), [3, 1, 4, 2]);
  const same = <T,>(v: T) => v;
  assert.deepEqual(sortVenues(list, 'nearest', null, same), list); // no location: unchanged
});

test('colour-blind mode adds a glyph and a different palette', () => {
  assert.equal(levelStyle('high').glyph, '!');
  assert.equal(levelStyle('low').glyph, null);
  assert.deepEqual(levelStyle('high', true), { label: 'Kalabalık', color: '#D55E00', glyph: '!' });
});

test('share message and link round trip', () => {
  const text = shareMessage(venue({}));
  assert.match(text, /^Demo Kafe Moda şu an orta \(~%40\)\. availy'de gör: https:\/\/erayerb\.github\.io\/availy\.app\/v2\/\?venue=/);
  assert.match(shareMessage(venue({ crowd: { state: 'unexplored' } })), /henüz güncel bildirim yok/);
  assert.equal(venueFromQuery(new URL(venueLink('Demo Kafe Moda')).search), 'Demo Kafe Moda');
  assert.match(shareMessage(venue({ open_now: false })), /kapalı, 08:00'de açılıyor/);
  assert.equal(venueFromQuery('?x=1'), null);
});

test('amenities follow type and purpose', () => {
  assert.deepEqual(amenitiesFor({ category: 'coworking', tags: [] }).map((a) => a.label), ['Wi-Fi', 'Priz', 'Sessiz alan', 'Toplantı odası']);
  assert.ok(amenitiesFor({ category: 'bar', tags: ['quiet'] }).some((a) => a.label === 'Sessiz alan'));
});

test('campaign coupon limit', () => {
  const limited = { ...campaign, id: 'lim', maxClaims: 2 };
  let coupons = claimCoupon([], limited, 'a', NOW, 'AV-AAAA').coupons;
  assert.equal(remainingCoupons(limited, coupons), 1);
  coupons = claimCoupon(coupons, limited, 'b', NOW, 'AV-BBBB').coupons;
  assert.equal(remainingCoupons(limited, coupons), 0);
  const third = claimCoupon(coupons, limited, 'c', NOW, 'AV-CCCC');
  assert.equal(third.error, 'Bu kampanyanın kupon sınırı doldu.');
  assert.equal(claimCoupon(coupons, limited, 'a', NOW, 'AV-ZZZZ').coupon?.code, 'AV-AAAA'); // own coupon still shown
  assert.equal(remainingCoupons(campaign, coupons), null); // no limit
});

test('loyalty QR round trip', () => {
  const code = customerCode('eray@x.com');
  assert.equal(parseCustomerQr(customerQrPayload(code)), code);
  assert.equal(parseCustomerQr(` ${code.toLowerCase()} `), code); // typed by hand
  assert.equal(parseCustomerQr('https://example.com'), null);
});
