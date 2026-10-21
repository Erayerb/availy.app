import assert from 'node:assert/strict';
import { test } from 'node:test';

import { labelPriority, visibleLabels } from '../src/lib/labels.ts';

// Screen position = lon/lat used directly as pixels
const project = (v: { lat: number; lon: number }) => ({ x: v.lon, y: v.lat });
const venue = (id: number, x: number, y: number, name = 'Kafe') => ({ id, name, lat: y, lon: x });

test('names that would overlap are hidden; far apart ones are all shown', () => {
  const list = [venue(1, 100, 100), venue(2, 100, 110), venue(3, 400, 100), venue(4, 100, 300)];
  assert.deepEqual([...visibleLabels(list, project)], [1, 3, 4]);
});

test('the selected venue and live venues get their names first', () => {
  const list = [
    { ...venue(1, 100, 100), crowd: { state: 'unexplored' } },
    { ...venue(2, 105, 100), crowd: { state: 'live' } },
    { ...venue(3, 110, 100), crowd: { state: 'stale' } },
  ];
  assert.deepEqual(labelPriority(list, null).map((v) => v.id), [2, 1, 3]);
  assert.deepEqual(labelPriority(list, 3).map((v) => v.id), [3, 2, 1]);
  assert.deepEqual([...visibleLabels(labelPriority(list, 3), project)], [3]);
});

test("a name does not cover another venue's dot", () => {
  // Venue 2 sits right where venue 1's name would go (to the right of its dot)
  const list = [venue(1, 100, 100), venue(2, 130, 100), venue(3, 300, 100)];
  assert.deepEqual([...visibleLabels(list, project)], [2, 3]);
});

test('long names take two lines', async () => {
  const { labelSize, LABEL_MAX_WIDTH } = await import('../src/lib/labels.ts');
  assert.equal(labelSize('Mado').height, 15);
  assert.deepEqual(labelSize('Nusr-Et Burger Nişantaşı Şubesi'), { width: LABEL_MAX_WIDTH, height: 30 });
});
