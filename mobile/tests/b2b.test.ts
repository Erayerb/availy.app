import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  activeCampaignForVenue,
  campaignsNear,
  createCampaign,
  deadHourSuggestion,
  endCampaign,
  isActive,
  timeLeft,
  validateCampaign,
  visibleCampaigns,
  type Campaign,
} from '../src/lib/campaigns.ts';
import { distanceKm, formatDistance, sortByDistance } from '../src/lib/geo.ts';
import { isLocalVenueId, LOCAL_ID_START } from '../src/lib/localVenues.ts';
import { campaignCostNote } from '../src/lib/plans.ts';
import { formatHour, nearbyCompetitors } from '../src/lib/stats.ts';

const NOW = new Date('2026-10-13T10:00:00Z'); // 13:00 in Istanbul
const MODA = { lat: 40.984, lon: 29.026 };
const TAKSIM = { lat: 41.0369, lon: 28.985 };

function campaign(overrides: Partial<Parameters<typeof createCampaign>[0]> = {}, now = NOW): Campaign {
  return createCampaign(
    { venueId: 1, venueName: 'Demo Kafe Moda', ...MODA, message: 'Kahveler %20 indirimli', discount: 20, radiusKm: 2, durationHours: 2, ...overrides },
    now,
    `c-${Math.random()}`,
  );
}

test('distance and its Turkish formatting', () => {
  const d = distanceKm(MODA, TAKSIM);
  assert.ok(d > 6 && d < 8, `Moda-Taksim ~7 km, got ${d}`);
  assert.equal(formatDistance(0.83), '850 m');
  assert.equal(formatDistance(0.01), '50 m');
  assert.equal(formatDistance(1.24), '1,2 km');
});

test('campaign lasts for the chosen hours and can be ended early', () => {
  const c = campaign();
  assert.ok(isActive(c, NOW));
  assert.ok(isActive(c, new Date(NOW.getTime() + 119 * 60_000)));
  assert.ok(!isActive(c, new Date(NOW.getTime() + 120 * 60_000)));
  assert.ok(!isActive(endCampaign(c, NOW), NOW));
});

test('timeLeft text', () => {
  const c = campaign();
  assert.equal(timeLeft(c, NOW), '2 sa kaldı');
  assert.equal(timeLeft(c, new Date(NOW.getTime() + 40 * 60_000)), '1 sa 20 dk kaldı');
  assert.equal(timeLeft(c, new Date(NOW.getTime() + 105 * 60_000)), '15 dk kaldı');
  assert.equal(timeLeft(c, new Date(NOW.getTime() + 3 * 3_600_000)), 'Bitti');
});

test('users only see active campaigns whose radius reaches them, nearest first', () => {
  const near = campaign({ radiusKm: 1 });
  const wide = campaign({ venueId: 2, venueName: 'Uzak', lat: 41.0, lon: 29.0, radiusKm: 5 });
  const tooSmall = campaign({ venueId: 3, venueName: 'Dar', lat: 41.0, lon: 29.0, radiusKm: 1 });
  const ended = endCampaign(campaign({ venueId: 4 }), NOW);
  const found = campaignsNear([wide, tooSmall, ended, near], MODA, NOW);
  assert.deepEqual(found.map((f) => f.campaign.venueId), [1, 2]);
  assert.equal(activeCampaignForVenue([ended, near], 1, NOW), near);
  assert.equal(activeCampaignForVenue([ended], 4, NOW), null);
});

test('campaign message validation', () => {
  assert.equal(validateCampaign('  '), 'Kampanya mesajını yaz.');
  assert.equal(validateCampaign('x'.repeat(141)), 'Mesaj en fazla 140 karakter olabilir.');
  assert.equal(validateCampaign('Kahveler %20 indirimli'), null);
});

test('dead hour suggestion matches the venue type', () => {
  assert.equal(
    deadHourSuggestion('cafe'),
    'Şu an çok sayıda boş yerimiz var! Önümüzdeki 2 saat tüm kahvelerde %20 indirim.',
  );
  assert.match(deadHourSuggestion('restaurant', 30, 1), /1 saat tüm menüde %30/);
});

test('hours are written as 09:00', () => {
  assert.equal(formatHour(9), '09:00');
});

test('competitors: the same kind of venue within 2 km, nearest first', () => {
  const venue = (id: number, category: string, tags: string[], lat: number, lon: number) =>
    ({ id, name: `V${id}`, category, tags, lat, lon }) as never;
  const me = venue(1, 'cafe', ['socializing'], MODA.lat, MODA.lon);
  const all = [
    me,
    venue(2, 'cafe', ['quiet'], 40.99, 29.025), // same category, ~0.7 km
    venue(3, 'bar', ['socializing'], 40.985, 29.027), // shared tag but a bar: not a café's competitor
    venue(4, 'library', ['quiet'], 40.985, 29.027), // unrelated
    venue(5, 'cafe', ['socializing'], TAKSIM.lat, TAKSIM.lon), // too far
  ];
  assert.deepEqual(nearbyCompetitors(me, all).map((c) => c.venue.id), [2]);
});

test('campaign cost note depends on the plan', () => {
  assert.equal(campaignCostNote('saas'), 'Paketine dahil (sınırsız).');
  assert.equal(campaignCostNote('pay_per_use'), 'Bu kampanyanın ücreti ₺150.');
});

test('without a location every active campaign is visible', () => {
  const far = campaign({ venueId: 9, lat: 41.1, lon: 29.05, radiusKm: 1 });
  const ended = endCampaign(campaign({ venueId: 8 }), NOW);
  assert.deepEqual(visibleCampaigns([far, ended], null, NOW).map((v) => v.campaign.venueId), [9]);
  assert.deepEqual(visibleCampaigns([far], MODA, NOW), []);
});

test('sortByDistance puts the nearest venue first', () => {
  const venues = [{ id: 1, ...TAKSIM }, { id: 2, lat: 40.985, lon: 29.027 }, { id: 3, ...MODA }];
  assert.deepEqual(sortByDistance(venues, MODA).map((v) => v.id), [3, 2, 1]);
});

test('venues added only on a phone in v1 are told apart by their ids', () => {
  assert.ok(isLocalVenueId(LOCAL_ID_START) && !isLocalVenueId(38));
});
