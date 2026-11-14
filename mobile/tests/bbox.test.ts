import assert from 'node:assert/strict';
import { test } from 'node:test';

import { containsBounds, formatBBox, needsRequery, regionToBounds } from '../src/lib/bbox.ts';

const REGION = { latitude: 41, longitude: 29, latitudeDelta: 0.2, longitudeDelta: 0.4 };

test('converts a region to minLon,minLat,maxLon,maxLat', () => {
  assert.equal(formatBBox(regionToBounds(REGION)), '28.8,40.9,29.2,41.1');
});

test('padding enlarges the bounds around the same center', () => {
  assert.deepEqual(regionToBounds(REGION, 2), [28.6, 40.8, 29.4, 41.2]);
});

test('clamps to valid coordinate ranges', () => {
  const bounds = regionToBounds({ latitude: 89, longitude: 179, latitudeDelta: 10, longitudeDelta: 10 });
  assert.deepEqual(bounds, [174, 84, 180, 90]);
});

test('containsBounds: small pan stays inside the padded area', () => {
  const padded = regionToBounds(REGION, 2);
  const panned = regionToBounds({ ...REGION, longitude: 29.05 });
  assert.equal(containsBounds(padded, panned), true);
});

test('containsBounds: moving far away leaves the padded area', () => {
  const padded = regionToBounds(REGION, 2);
  const moved = regionToBounds({ ...REGION, longitude: 30 });
  assert.equal(containsBounds(padded, moved), false);
});

test('the map fetches again when it leaves the fetched area or zooms well in', () => {
  const wide = { latitude: 41.0, longitude: 29.0, latitudeDelta: 0.4, longitudeDelta: 0.4 };
  const queried = regionToBounds(wide, 2);
  // Panning a little inside the fetched area: nothing new
  assert.equal(needsRequery(queried, regionToBounds({ ...wide, longitude: 29.05 }), 2), false);
  // Out of it: fetch
  assert.equal(needsRequery(queried, regionToBounds({ ...wide, longitude: 29.5 }), 2), true);
  // Zoomed in on one street inside it: fetch, so no venue there is left out
  assert.equal(needsRequery(queried, regionToBounds({ ...wide, latitudeDelta: 0.02, longitudeDelta: 0.02 }), 2), true);
  // Zoomed in only a little: nothing new
  assert.equal(needsRequery(queried, regionToBounds({ ...wide, latitudeDelta: 0.3, longitudeDelta: 0.3 }), 2), false);
});
