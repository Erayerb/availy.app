import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bboxAround, nearestOpenVenue } from '../src/lib/nearby.ts';

const at = { lat: 41.0482, lon: 28.9934 };
const venue = (id: number, dLat: number, open = true) => ({ id, lat: at.lat + dLat, lon: at.lon, open_now: open });

test('nearest open venue within 150 m', () => {
  // ~50 m, ~100 m (closed), ~300 m away
  const list = [venue(1, 0.0009), venue(2, 0.00045), venue(3, 0.0009, false), venue(4, 0.0027)];
  assert.equal(nearestOpenVenue(list, at)?.id, 2);
  assert.equal(nearestOpenVenue([venue(4, 0.0027)], at), null);
});

test('bbox around a point', () => {
  assert.equal(bboxAround(at, 0.001), '28.99240,41.04720,28.99440,41.04920');
});
