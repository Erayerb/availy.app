import assert from 'node:assert/strict';
import { test } from 'node:test';

import { groupCandidates } from '../src/lib/groups.ts';

test('group candidates: friends first, then people around, each once', () => {
  const list = groupCandidates(
    [{ username: 'ayse' }, { username: 'can' }],
    [
      { username: 'can', mutual: 2, shared_venues: 0 },
      { username: 'deniz', mutual: 0, shared_venues: 3 },
      { username: 'ece', mutual: 1, shared_venues: 0 },
    ],
    ['ayse'],
  );
  assert.deepEqual(list, [
    { username: 'can', why: 'Arkadaşın' },
    { username: 'deniz', why: 'Aynı mekanlara gidiyorsunuz' },
    { username: 'ece', why: '1 ortak arkadaş' },
  ]);
});
