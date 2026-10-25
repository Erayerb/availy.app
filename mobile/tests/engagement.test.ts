import assert from 'node:assert/strict';
import { test } from 'node:test';

import { amenitiesFor } from '../src/lib/amenities.ts';
import { toCampaign, toCoupon } from '../src/lib/campaignApi.ts';
import { couponValid, normalizeCode, parseCouponQr, remainingCoupons } from '../src/lib/coupons.ts';
import {
  availyPoints,
  customerQrPayload,
  parseCustomerQr,
  describeProgram,
  validateProgram,
  type LoyaltyProgram,
} from '../src/lib/loyalty.ts';
import { levelStyle } from '../src/lib/occupancy.ts';
import { checkinShareMessage, shareMessage, venueFromQuery, venueLink } from '../src/lib/share.ts';
import { byQuietest, sortVenues } from '../src/lib/sort.ts';
import { canWatch, notificationText, toggleWatch, watchTriggered } from '../src/lib/watch.ts';

const NOW = new Date('2026-10-13T10:00:00Z');

const venue = (over: Record<string, unknown>) =>
  ({
    id: 1, name: 'Demo Kafe Moda', category: 'cafe', tags: ['socializing'], lat: 40.984, lon: 29.026,
    open_now: true, hours: '08:00–23:00', opens_at: '08:00',
    crowd: { state: 'live', level: 'medium', ratio: 0.4, reporters: 3, last_report_at: '', queue: null, seats: null },
    ...over,
  }) as never;

test('coupon codes typed or scanned', () => {
  assert.equal(normalizeCode(' av-11 11 '), 'AV-1111');
  assert.equal(parseCouponQr('availy:coupon:av-7k3p'), 'AV-7K3P');
  assert.equal(parseCouponQr('merhaba'), null);
});

test('server campaigns and coupons in the app\'s shapes', () => {
  const server = {
    id: 12, venue_id: 7, venue_name: 'Demo Kafe Moda', lat: 40.98, lon: 29.02, message: 'Kahveler %20', discount: 20,
    radius_km: 2, max_claims: 10, duration_hours: 2, starts_at: '2026-10-13T10:00:00Z', ends_at: '2026-10-13T12:00:00Z',
    claims: 4, redemptions: 1, views: 30,
  };
  const c = toCampaign(server);
  assert.equal(c.id, '12');
  assert.deepEqual(c.stats, { views: 30, claims: 4, redemptions: 1 });
  assert.equal(remainingCoupons(c), 6);
  assert.equal(remainingCoupons({ ...c, maxClaims: null }), null);
  const coupon = toCoupon({
    code: 'AV-AAAA', campaign_id: 12, venue_id: 7, venue_name: 'Demo Kafe Moda', message: 'Kahveler %20', discount: 20,
    claimed_at: '2026-10-13T10:05:00Z', redeemed_at: null, ends_at: '2026-10-13T12:00:00Z',
  });
  assert.equal(coupon.campaignId, '12');
  assert.equal(couponValid(coupon, NOW), true);
  assert.equal(couponValid(coupon, new Date('2026-10-13T12:00:00Z')), false);
  assert.equal(couponValid({ ...coupon, redeemedAt: '2026-10-13T10:30:00Z' }, NOW), false);
});

const stampProgram: LoyaltyProgram = {
  venueId: 7, venueName: 'Demo Kafe Moda', kind: 'stamps', stampsRequired: 5, reward: '1 kahve bedava', price: 0, perk: '',
};

test('loyalty programs: validation, description, codes and points', () => {
  assert.equal(validateProgram({ ...stampProgram, stampsRequired: 1 }), 'Damga sayısı 2 ile 20 arasında olmalı.');
  assert.equal(validateProgram(stampProgram), null);
  const membership = { ...stampProgram, kind: 'membership' as const, price: 149, perk: 'her kahvede %15 indirim' };
  assert.equal(validateProgram(membership), null);
  assert.equal(validateProgram({ ...membership, price: 0 }), 'Aylık ücreti yaz.');
  assert.equal(describeProgram(stampProgram), '5 damga = 1 kahve bedava');
  assert.equal(describeProgram(membership), '₺149/ay · her kahvede %15 indirim');
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
  assert.match(checkinShareMessage('Demo Kafe', 'Sakin', false), /^📍 Demo Kafe'deyim · şu an sakin\. .*\?venue=Demo%20Kafe$/);
  assert.match(checkinShareMessage('Demo Kafe', 'Kalabalık', true), /ilk ben keşfettim ✨ · şu an kalabalık/);
  assert.match(checkinShareMessage('Demo Kafe', 'Sakin', false, ' Kahve harika '), /şu an sakin\. “Kahve harika” availy'de/);
  assert.equal(venueFromQuery(new URL(venueLink('Demo Kafe Moda')).search), 'Demo Kafe Moda');
  assert.match(shareMessage(venue({ open_now: false })), /kapalı, 08:00'de açılıyor/);
  assert.equal(venueFromQuery('?x=1'), null);
});

test('amenities follow type and purpose', () => {
  assert.deepEqual(amenitiesFor({ category: 'coworking', tags: ['wifi'] }).map((a) => a.label), ['Ücretsiz Wi-Fi', 'Priz', 'Sessiz alan', 'Toplantı odası']);
  // No Wi-Fi in the data: not guessed
  assert.ok(!amenitiesFor({ category: 'cafe', tags: [] }).some((a) => a.label === 'Ücretsiz Wi-Fi'));
  assert.ok(amenitiesFor({ category: 'bar', tags: ['quiet'] }).some((a) => a.label === 'Sessiz alan'));
});

test('loyalty QR round trip', () => {
  const code = 'M-012345';
  assert.equal(parseCustomerQr(customerQrPayload(code)), code);
  assert.equal(parseCustomerQr(` ${code.toLowerCase()} `), code); // typed by hand
  assert.equal(parseCustomerQr('https://example.com'), null);
});
