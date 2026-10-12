import assert from 'node:assert/strict';
import { test } from 'node:test';

import { categoryLabel, TAG_OPTIONS, toggleSingle, toggleTag } from '../src/lib/filters.ts';

test('filter chips are the purposes in Turkish', () => {
  assert.deepEqual(
    TAG_OPTIONS.map((o) => o.label),
    ['Sosyalleşme', 'Co-working', 'Eğlence', 'Sessizlik', 'Yemek'],
  );
});

test('toggleTag adds, removes and keeps a sorted order', () => {
  assert.deepEqual(toggleTag([], 'quiet'), ['quiet']);
  assert.deepEqual(toggleTag(['quiet'], 'coworking'), ['coworking', 'quiet']);
  assert.deepEqual(toggleTag(['coworking', 'quiet'], 'quiet'), ['coworking']);
});

test('categoryLabel translates known categories', () => {
  assert.equal(categoryLabel('cafe'), 'Kafe');
  assert.equal(categoryLabel('bar'), 'Bar');
  assert.equal(categoryLabel('library'), 'Kütüphane');
  assert.equal(categoryLabel('restaurant'), 'Restoran');
  assert.equal(categoryLabel('club'), 'Mekan'); // night clubs are not supported
  assert.equal(categoryLabel('unknown'), 'Mekan');
});

test('toggleSingle selects, switches and clears on second tap', () => {
  assert.equal(toggleSingle(null, 'Kadıköy'), 'Kadıköy');
  assert.equal(toggleSingle('Kadıköy', 'Beşiktaş'), 'Beşiktaş');
  assert.equal(toggleSingle('Kadıköy', 'Kadıköy'), null);
});
