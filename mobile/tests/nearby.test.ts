import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bboxAround, CHECKIN_RADIUS_KM, nearestOpenVenue } from '../src/lib/nearby.ts';

const at = { lat: 41.0482, lon: 28.9934 };
const venue = (id: number, dLat: number, open = true) => ({ id, lat: at.lat + dLat, lon: at.lon, open_now: open });

test('nearest open venue within the check-in radius', () => {
  // ~100 m, ~50 m, ~100 m (closed), and 100 m beyond the radius
  const beyond = (CHECKIN_RADIUS_KM + 0.1) / 111;
  const list = [venue(1, 0.0009), venue(2, 0.00045), venue(3, 0.0009, false), venue(4, beyond)];
  assert.equal(nearestOpenVenue(list, at)?.id, 2);
  assert.equal(nearestOpenVenue([venue(4, beyond)], at), null);
});

test('bbox around a point', () => {
  assert.equal(bboxAround(at, 0.001), '28.99240,41.04720,28.99440,41.04920');
});
