import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cardPosition } from '../src/lib/cardPosition.ts';

const base = {
  card: { width: 250, height: 200 },
  screen: { width: 390, height: 844 },
  topInset: 180,
  margin: 8,
  pinHeight: 40,
};

test('card sits centered above the pin', () => {
  assert.deepEqual(cardPosition({ ...base, pin: { x: 195, y: 600 } }), { x: 70, y: 352 });
});

test('card flips below the pin when there is no room above', () => {
  assert.deepEqual(cardPosition({ ...base, pin: { x: 195, y: 250 } }), { x: 70, y: 258 });
});

test('card stays inside the screen horizontally', () => {
  assert.equal(cardPosition({ ...base, pin: { x: 10, y: 600 } }).x, 8);
  assert.equal(cardPosition({ ...base, pin: { x: 385, y: 600 } }).x, 132);
});
