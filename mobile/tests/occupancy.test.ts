import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LEVELS, levelStyle } from '../src/lib/occupancy.ts';

test('every level has a distinct color and Turkish label', () => {
  const styles = LEVELS.map((level) => levelStyle(level));
  assert.deepEqual(styles.map((s) => s.label), ['Sakin', 'Orta', 'Kalabalık']);
  assert.equal(new Set(styles.map((s) => s.color)).size, LEVELS.length);
});

test('unknown level falls back to grey', () => {
  assert.equal(levelStyle('something-else').label, 'Bilinmiyor');
});

