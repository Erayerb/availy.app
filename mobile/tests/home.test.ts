import assert from 'node:assert/strict';
import { test } from 'node:test';

import { stableShuffle } from '../src/lib/shuffle.ts';
import { categoryVisual } from '../src/lib/visuals.ts';

const items = Array.from({ length: 20 }, (_, i) => ({ id: i + 1 }));

test('stableShuffle keeps every item exactly once', () => {
  const shuffled = stableShuffle(items, 'seed');
  assert.deepEqual(
    shuffled.map((x) => x.id).sort((a, b) => a - b),
    items.map((x) => x.id),
  );
});

test('stableShuffle is the same for the same seed and mixes the order', () => {
  const a = stableShuffle(items, 'seed').map((x) => x.id);
  assert.deepEqual(stableShuffle(items, 'seed').map((x) => x.id), a);
  assert.notDeepEqual(a, items.map((x) => x.id));
  assert.notDeepEqual(stableShuffle(items, 'other').map((x) => x.id), a);
});

test('stableShuffle does not modify the input', () => {
  const copy = [...items];
  stableShuffle(items, 'seed');
  assert.deepEqual(items, copy);
});

test('every venue category has a placeholder visual', () => {
  for (const category of ['cafe', 'bar', 'coworking', 'library', 'restaurant']) {
    assert.notEqual(categoryVisual(category).icon, 'map-pin');
  }
  assert.equal(categoryVisual('club').icon, 'map-pin');
});
