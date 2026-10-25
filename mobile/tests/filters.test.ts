import assert from 'node:assert/strict';
import { test } from 'node:test';

import { categoryLabel, foldTr, TAG_OPTIONS, toggleSingle, toggleTag } from '../src/lib/filters.ts';

test('filter chips are the purposes in Turkish', () => {
  assert.deepEqual(
    TAG_OPTIONS.map((o) => o.label),
    ['Sosyalleşme', 'Ortak çalışma', 'Eğlence', 'Sessizlik', 'Yemek', 'Gece hayatı', 'Ücretsiz Wi-Fi'],
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

test('foldTr removes Turkish letters for English-keyboard search', () => {
  assert.equal(foldTr('Nişantaşı'), 'nisantasi');
  assert.equal(foldTr('İSTANBUL Üsküdar Çengelköy Ağa'), 'istanbul uskudar cengelkoy aga');
  assert.equal(foldTr('KADIKÖY'), 'kadikoy');
});

test('trending: venues with check-ins in the last 24 hours, most people first', async () => {
  const { trending } = await import('../src/lib/sort.ts');
  const list = [{ id: 1, trend: 2 }, { id: 2, trend: 0 }, { id: 3, trend: 5 }, { id: 4 }];
  assert.deepEqual(trending(list).map((v) => v.id), [3, 1]);
});
