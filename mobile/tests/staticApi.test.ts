import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { averageOccupancy, BUCKET_SECONDS, classify, dummyOccupancy } from '../src/lib/dummyOccupancy.ts';
import { createStaticApi } from '../src/lib/staticApi.ts';

const api = createStaticApi(
  JSON.parse(readFileSync(new URL('../src/data/demoVenues.json', import.meta.url), 'utf8')),
);
const staticVenuesInBBox = api.venuesInBBox;
const staticSearch = api.search;
const staticDistricts = api.districts;

const EVENING = new Date('2026-10-12T16:00:00Z'); // 19:00 in Istanbul
const NIGHT = new Date('2026-10-12T00:00:00Z'); // 03:00 in Istanbul
const KADIKOY_BBOX = '29.00,40.97,29.05,41.00';

test('classify uses the backend thresholds', () => {
  assert.equal(classify(0.39), 'low');
  assert.equal(classify(0.4), 'medium');
  assert.equal(classify(0.75), 'medium');
  assert.equal(classify(0.76), 'high');
});

test('dummy occupancy is stable inside a 5 minute bucket', () => {
  const later = new Date(EVENING.getTime() + (BUCKET_SECONDS - 1) * 1000);
  assert.deepEqual(dummyOccupancy(1, EVENING), dummyOccupancy(1, later));
});

test('dummy occupancy stays in range and empty venues stay empty', () => {
  for (let id = 1; id <= 40; id++) {
    const occ = dummyOccupancy(id, EVENING);
    assert.ok(occ.ratio >= 0 && occ.ratio <= 1);
    assert.equal(dummyOccupancy(id, EVENING, 0).ratio, 0);
  }
});

test('evenings are busier than nights', () => {
  const mean = (at: Date) => averageOccupancy(Array.from({ length: 40 }, (_, i) => dummyOccupancy(i + 1, at).ratio)).ratio;
  assert.ok(mean(EVENING) > mean(NIGHT) + 0.4);
});

test('bbox query returns only venues inside, with occupancy', () => {
  const venues = staticVenuesInBBox(KADIKOY_BBOX, []);
  assert.ok(venues.length > 0);
  for (const v of venues) {
    assert.equal(v.district, 'Kadıköy');
    assert.ok(['low', 'medium', 'high'].includes(v.occupancy.level));
    assert.ok(!('popularity' in v));
  }
});

test('tag filter keeps venues having at least one tag', () => {
  const food = staticVenuesInBBox('28.9,40.9,29.1,41.1', ['food']);
  assert.ok(food.length > 0);
  assert.ok(food.every((v) => v.tags.includes('food')));
});

test('search is Turkish case-insensitive and filters by district and ids', () => {
  const byName = staticSearch('KÜTÜPHANE', null, []);
  assert.ok(byName.length >= 2);
  assert.ok(byName.every((v) => v.category === 'library'));
  assert.ok(staticSearch('', 'Şişli', []).every((v) => v.district === 'Şişli'));
  assert.deepEqual(staticSearch('', null, [], [1, 2]).map((v) => v.id).sort(), [1, 2]);
});

test('district busyness is the same for every venue in the district', () => {
  const kadikoy = staticSearch('', 'Kadıköy', [], undefined, EVENING);
  const values = new Set(kadikoy.map((v) => JSON.stringify(v.district_occupancy)));
  assert.equal(values.size, 1);
});

test('districts are sorted in Turkish order', () => {
  assert.deepEqual(staticDistricts(), ['Beşiktaş', 'Beyoğlu', 'Kadıköy', 'Şişli', 'Üsküdar']);
});

test('always-busy test venues are crowded at every hour, even at night', () => {
  for (let hour = 0; hour < 24; hour++) {
    const at = new Date(Date.UTC(2026, 9, 12, (hour + 21) % 24, 30)); // Istanbul = UTC+3
    assert.equal(dummyOccupancy(7, at, 1, true).level, 'high');
  }
  const busy = staticSearch('Popüler', null, [], undefined, NIGHT);
  assert.ok(busy.length >= 3);
  assert.ok(busy.every((v) => v.occupancy.level === 'high'));
  assert.ok(!('always_busy' in busy[0]));
});

test('search works without Turkish letters and matches districts too', () => {
  assert.ok(staticSearch('nisantasi', null, []).some((v) => v.name === 'Demo Kafe Nişantaşı'));
  assert.ok(staticSearch('uskudar', null, []).every((v) => v.district === 'Üsküdar'));
});
