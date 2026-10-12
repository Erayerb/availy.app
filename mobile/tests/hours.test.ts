import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hoursFor, hoursLabel, isOpenAtHour, istanbulHour, opensAt } from '../src/lib/hours.ts';

test('hours by category match the backend', () => {
  assert.equal(hoursLabel(hoursFor('cafe')), '08:00–23:00');
  assert.equal(hoursLabel(hoursFor('bar')), '17:00–03:00');
  assert.equal(hoursLabel(hoursFor('restaurant')), '11:00–00:00');
  assert.equal(hoursLabel(hoursFor('cafe', true)), '24 saat açık');
  assert.equal(opensAt(hoursFor('library')), '09:00');
});

test('open/closed, including past midnight', () => {
  assert.ok(isOpenAtHour(hoursFor('cafe'), 8) && !isOpenAtHour(hoursFor('cafe'), 23));
  assert.ok(isOpenAtHour(hoursFor('bar'), 2) && !isOpenAtHour(hoursFor('bar'), 3));
  assert.ok(!isOpenAtHour(hoursFor('restaurant'), 0));
  assert.ok(isOpenAtHour(hoursFor('cafe', true), 4));
  assert.equal(istanbulHour(new Date('2026-10-12T21:30:00Z')), 0);
});
