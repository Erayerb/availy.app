import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatRatio, LEVELS, levelStyle } from '../src/lib/occupancy.ts';

test('every level has a distinct color and Turkish label', () => {
  const styles = LEVELS.map(levelStyle);
  assert.deepEqual(styles.map((s) => s.label), ['Sakin', 'Orta', 'Kalabalık']);
  assert.equal(new Set(styles.map((s) => s.color)).size, LEVELS.length);
});

test('unknown level falls back to grey', () => {
  assert.equal(levelStyle('something-else').label, 'Bilinmiyor');
});

test('formatRatio shows a rounded Turkish percentage', () => {
  assert.equal(formatRatio(0.784), '%78 dolu');
  assert.equal(formatRatio(0), '%0 dolu');
  assert.equal(formatRatio(1), '%100 dolu');
});
