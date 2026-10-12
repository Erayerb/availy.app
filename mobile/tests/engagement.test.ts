import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import { changePassword, checkLogin, createAccount, deleteAccount, renameAccount } from '../src/lib/accounts.ts';
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
    occupancy: { level: 'medium', ratio: 0.4, updated_at: '' },
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

test('watch: offered for busy venues, fires below 70% while open', () => {
  assert.ok(canWatch(venue({ occupancy: { level: 'high', ratio: 0.85 } })));
  assert.ok(!canWatch(venue({})));
  assert.ok(watchTriggered(venue({ occupancy: { level: 'medium', ratio: 0.6 } })));
  assert.ok(!watchTriggered(venue({ open_now: false, occupancy: { level: 'low', ratio: 0.1 } })));
  const on = toggleWatch([], { id: 1, name: 'X' }, NOW);
  assert.equal(on.length, 1);
  assert.equal(toggleWatch(on, { id: 1, name: 'X' }, NOW).length, 0);
  assert.equal(notificationText(venue({ occupancy: { level: 'medium', ratio: 0.62 } })).body, 'Şu an %62 dolu. Gitmek için iyi bir zaman.');
});

test('sorting: quietest puts open, emptier venues first', () => {
  const list = [
    venue({ id: 1, occupancy: { ratio: 0.5 } }),
    venue({ id: 2, open_now: false, occupancy: { ratio: 0 } }),
    venue({ id: 3, occupancy: { ratio: 0.1 } }),
  ];
  assert.deepEqual(byQuietest(list).map((v: { id: number }) => v.id), [3, 1, 2]);
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
  assert.match(text, /^Demo Kafe Moda şu an %40 dolu \(Orta\)\. availy'de gör: https:\/\/erayerb\.github\.io\/availy\.app\/\?venue=/);
  assert.equal(venueFromQuery(new URL(venueLink('Demo Kafe Moda')).search), 'Demo Kafe Moda');
  assert.match(shareMessage(venue({ open_now: false })), /kapalı, 08:00'de açılıyor/);
  assert.equal(venueFromQuery('?x=1'), null);
});

test('amenities follow type and purpose', () => {
  assert.deepEqual(amenitiesFor({ category: 'coworking', tags: [] }).map((a) => a.label), ['Wi-Fi', 'Priz', 'Sessiz alan', 'Toplantı odası']);
  assert.ok(amenitiesFor({ category: 'bar', tags: ['quiet'] }).some((a) => a.label === 'Sessiz alan'));
});

const sha256 = async (t: string) => createHash('sha256').update(t).digest('hex');

test('profile: change password, rename and delete account', async () => {
  const accounts = (await createAccount({}, 'Eray', 'e@x.com', 'eski123', 's1', sha256)).accounts!;
  assert.equal((await changePassword(accounts, 'e@x.com', 'yanlis', 'yeni123', 's2', sha256)).error, 'Mevcut şifre hatalı.');
  const changed = (await changePassword(accounts, 'e@x.com', 'eski123', 'yeni123', 's2', sha256)).accounts!;
  assert.equal((await checkLogin(changed, 'e@x.com', 'yeni123', sha256)).error, null);
  assert.equal((await checkLogin(changed, 'e@x.com', 'eski123', sha256)).error, 'Şifre hatalı.');
  assert.equal(renameAccount(changed, 'E@x.com', ' Eray E ')['e@x.com'].name, 'Eray E');
  assert.deepEqual(deleteAccount(changed, 'e@x.com'), {});
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
