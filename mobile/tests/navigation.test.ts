import assert from 'node:assert/strict';
import { test } from 'node:test';

import { quieterAlternatives, shouldSuggestAlternatives } from '../src/lib/alternatives.ts';
import { ALL_DISTRICTS, districtsForSides, matchesDistricts, matchesSides, sideOf, toggleSide } from '../src/lib/istanbul.ts';
import { back, push } from '../src/lib/navigation.ts';

test('back returns to the previous screen, not always home', () => {
  let h = { current: 'home', stack: [] as string[] };
  h = push(h, 'favorites');
  h = push(h, 'map');
  h = back(h, 'home');
  assert.equal(h.current, 'favorites');
  h = back(h, 'home');
  assert.equal(h.current, 'home');
  assert.equal(back(h, 'home').current, 'home'); // empty history falls back
  assert.equal(push(h, 'home'), h); // same screen is not pushed twice
});

const DISTRICTS = ['Beşiktaş', 'Beyoğlu', 'Kadıköy', 'Şişli', 'Üsküdar'];

test('districts are grouped into European and Anatolian sides', () => {
  assert.equal(sideOf('Kadıköy'), 'anatolia');
  assert.equal(sideOf('Beşiktaş'), 'europe');
  assert.deepEqual(districtsForSides(DISTRICTS, ['europe']), ['Beşiktaş', 'Beyoğlu', 'Şişli']);
  assert.deepEqual(districtsForSides(DISTRICTS, ['anatolia']), ['Kadıköy', 'Üsküdar']);
  assert.deepEqual(districtsForSides(DISTRICTS, ['europe', 'anatolia']), DISTRICTS);
  assert.deepEqual(districtsForSides(DISTRICTS, []), DISTRICTS);
  assert.ok(!matchesSides('Bilinmeyen', ['europe']));
  assert.deepEqual(toggleSide(['europe'], 'anatolia'), ['europe', 'anatolia']);
  assert.deepEqual(toggleSide(['europe', 'anatolia'], 'europe'), ['anatolia']);
});

const venue = (id: number, category: string, tags: string[], ratio: number, level: string, lat: number, lon: number) =>
  ({ id, name: `V${id}`, category, tags, lat, lon, occupancy: { ratio, level } }) as never;

test('only crowded venues trigger the pop-up', () => {
  assert.ok(shouldSuggestAlternatives(venue(1, 'bar', [], 0.9, 'high', 0, 0)));
  assert.ok(!shouldSuggestAlternatives(venue(1, 'bar', [], 0.6, 'medium', 0, 0)));
});

test('alternatives: similar, clearly emptier, nearby, quiet ones first', () => {
  const full = venue(1, 'bar', ['socializing'], 0.8, 'high', 41.034, 28.979);
  const all = [
    full,
    venue(2, 'bar', ['entertainment'], 0.6, 'medium', 41.035, 28.98), // same category, medium, very close
    venue(3, 'cafe', ['socializing'], 0.2, 'low', 41.04, 28.985), // shared tag, quiet, a bit further
    venue(4, 'bar', [], 0.78, 'high', 41.034, 28.98), // also crowded
    venue(5, 'library', ['quiet'], 0.1, 'low', 41.034, 28.979), // unrelated type
    venue(6, 'bar', ['socializing'], 0.1, 'low', 41.1, 29.1), // too far
    venue(7, 'bar', ['socializing'], 0.75, 'medium', 41.034, 28.979), // not emptier enough (0.8 - 0.75 < 0.1)
  ];
  assert.deepEqual(quieterAlternatives(full, all).map((a) => a.venue.id), [3, 2]);
  // A venue with a campaign that reaches the user goes first
  const withCampaign = quieterAlternatives(full, all, new Set([2]));
  assert.deepEqual(withCampaign.map((a) => [a.venue.id, a.hasCampaign]), [[2, true], [3, false]]);
  assert.equal(quieterAlternatives(full, all, new Set(), 1).length, 1);
});

test('all 39 Istanbul districts are listed and split into the two sides', () => {
  assert.equal(ALL_DISTRICTS.length, 39);
  assert.equal(districtsForSides(ALL_DISTRICTS, ['europe']).length, 25);
  assert.equal(districtsForSides(ALL_DISTRICTS, ['anatolia']).length, 14);
  assert.ok(ALL_DISTRICTS.every((d) => sideOf(d) !== null));
});

test('several districts can be chosen at once', () => {
  assert.ok(matchesDistricts('Kadıköy', []));
  assert.ok(matchesDistricts('Kadıköy', ['Beşiktaş', 'Kadıköy']));
  assert.ok(!matchesDistricts('Şişli', ['Beşiktaş', 'Kadıköy']));
});
