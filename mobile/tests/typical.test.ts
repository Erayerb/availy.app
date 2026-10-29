import assert from 'node:assert/strict';
import { test } from 'node:test';

import { comparedToUsual, hourRanges, typicalLines, usualNowText } from '../src/lib/typical.ts';

test('hours become ranges', () => {
  assert.equal(hourRanges([19, 18]), '18:00–20:00');
  assert.equal(hourRanges([10, 18, 19, 23]), '10:00–11:00, 18:00–20:00 ve 23:00–00:00');
});

test('usual busy and quiet hours in Turkish', () => {
  assert.deepEqual(typicalLines({ scope: 'today', weekday: 5, busy_hours: [18, 19], quiet_hours: [10] }), [
    'Cumartesi günleri genelde 18:00–20:00 kalabalık',
    'En sakin: 10:00–11:00',
  ]);
  assert.deepEqual(typicalLines({ scope: 'all', weekday: 0, busy_hours: [], quiet_hours: [15] }), ['Genelde en sakin: 15:00–16:00']);
  assert.deepEqual(typicalLines({ scope: null, weekday: 0, busy_hours: [], quiet_hours: [] }), []);
});

test('"Şu an normalden daha sakin": the live level against this hour\'s usual one', () => {
  assert.equal(comparedToUsual('low', 'high'), 'Şu an normalden daha sakin (bu saatte genelde Kalabalık)');
  assert.equal(comparedToUsual('high', 'low'), 'Şu an normalden daha kalabalık (bu saatte genelde Sakin)');
  assert.equal(comparedToUsual('medium', 'medium'), null);
  assert.equal(comparedToUsual(null, 'high'), null);
  assert.equal(comparedToUsual('low', null), null);
});

test('no live report: the usual level at this hour, marked as an estimate', () => {
  assert.equal(usualNowText(null, 'low'), 'Genelde bu saatte sakin (tahmini)');
  assert.equal(usualNowText(null, 'high'), 'Genelde bu saatte kalabalık (tahmini)');
  assert.equal(usualNowText('medium', 'low'), null); // the live level is shown instead
  assert.equal(usualNowText(null, null), null);
});
