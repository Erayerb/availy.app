import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CLUSTER_MAX_ZOOM, clusterColor, clusterVenues, clusterZoomTarget, majorityColor, project } from '../src/lib/clusters.ts';

const v = (id: number, lat: number, lon: number) => ({ id, lat, lon });
// Two cafés 20 m apart and one 2 km away
const venues = [v(1, 40.97, 29.07), v(2, 40.9702, 29.07), v(3, 40.988, 29.07)];

test('close dots become one cluster with a count; zooming in splits them', () => {
  const far = clusterVenues(venues, 13);
  assert.deepEqual(far.map((i) => (i.kind === 'cluster' ? i.venues.map((x) => x.id) : i.venue.id)), [[1, 2], 3]);
  // From street level every venue has its own dot
  assert.ok(clusterVenues(venues, CLUSTER_MAX_ZOOM).every((i) => i.kind === 'venue'));
  // Zoomed out a lot: all three together
  const all = clusterVenues(venues, 10);
  assert.equal(all.length, 1);
  assert.equal(all[0].kind === 'cluster' && all[0].venues.length, 3);
});

test('the selected venue keeps its own dot', () => {
  const items = clusterVenues(venues, 13, 2);
  assert.deepEqual(items.map((i) => (i.kind === 'venue' ? i.venue.id : 'cluster')), [1, 2, 3]);
});

test('projection: 256 px world at zoom 0, twice as wide per zoom level', () => {
  assert.deepEqual(project(0, 0, 0), { x: 128, y: 128 });
  assert.equal(project(0, 180, 1).x, 512);
});

test('cluster colour: what most of its dots show', () => {
  const colors: Record<number, string> = { 1: 'green', 2: 'green', 3: 'red' };
  assert.equal(majorityColor([1, 2, 3], (id) => colors[id]), 'green');
  assert.equal(majorityColor([3], (id) => colors[id]), 'red');
});

test('clusters are never grey: closed and stale dots do not vote', () => {
  const look = (v: { id: number }) => ({ 1: 'grey', 2: 'grey', 3: 'green' })[v.id as 1 | 2 | 3];
  const live = { state: 'live' };
  const list = [
    { id: 1, open_now: false, crowd: live },
    { id: 2, open_now: true, crowd: { state: 'stale' } },
    { id: 3, open_now: true, crowd: live },
  ];
  assert.equal(clusterColor(list, look, 'purple'), 'green');
  assert.equal(clusterColor(list.slice(0, 2), look, 'purple'), 'purple');
});

test('a tap on a cluster zooms in at most 2 levels', () => {
  assert.equal(clusterZoomTarget(12, 18), 14);
  assert.equal(clusterZoomTarget(12, 13), 13);
  assert.equal(clusterZoomTarget(15.5, 20), CLUSTER_MAX_ZOOM + 1);
});
