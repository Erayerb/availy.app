import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseFavorites, toggleFavorite } from '../src/lib/favorites.ts';

test('toggleFavorite adds and removes ids', () => {
  assert.deepEqual(toggleFavorite([], 3), [3]);
  assert.deepEqual(toggleFavorite([3, 5], 3), [5]);
  assert.deepEqual(toggleFavorite([5], 3), [5, 3]);
});

test('parseFavorites ignores broken stored data', () => {
  assert.deepEqual(parseFavorites(null), []);
  assert.deepEqual(parseFavorites('oops'), []);
  assert.deepEqual(parseFavorites([1, 'x', 2.5, 1, 4]), [1, 4]);
});
