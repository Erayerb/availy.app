import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ANY_ASK_GAP_MS, COOLDOWN_MS, DWELL_MS, mayAsk, nextStay, rememberAsked, SAME_VENUE_DAY_MS, shouldSuggest, suggestionText } from '../src/lib/suggestion.ts';

test('a stay starts at a venue, goes on there and ends when walking away', () => {
  const stay = nextStay(null, 7, 1000)!;
  assert.deepEqual(stay, { venueId: 7, since: 1000, suggested: false });
  assert.equal(nextStay(stay, 7, 5000), stay);
  assert.deepEqual(nextStay(stay, 8, 6000), { venueId: 8, since: 6000, suggested: false });
  assert.equal(nextStay(stay, null, 6000), null);
});

test('suggest after a few minutes, once per stay, not right after a check-in there', () => {
  const stay = { venueId: 7, since: 0, suggested: false };
  assert.equal(shouldSuggest(stay, DWELL_MS - 1, null), false);
  assert.equal(shouldSuggest(stay, DWELL_MS, null), true);
  assert.equal(shouldSuggest({ ...stay, suggested: true }, DWELL_MS, null), false);
  // Checked in there an hour ago: not yet; three hours ago: ask again
  const now = 10 * COOLDOWN_MS;
  assert.equal(shouldSuggest(stay, now, now - COOLDOWN_MS / 2), false);
  assert.equal(shouldSuggest(stay, now, now - COOLDOWN_MS - 1), true);
});

test('walking past many venues asks at most hourly, the same venue twice a day', () => {
  const start = 100 * SAME_VENUE_DAY_MS;
  assert.equal(mayAsk({}, 7, start), true);
  const once = rememberAsked({}, 7, start);
  // Next door, a little later: not yet
  assert.equal(mayAsk(once, 8, start + ANY_ASK_GAP_MS - 1), false);
  assert.equal(mayAsk(once, 8, start + ANY_ASK_GAP_MS), true);
  // The same venue a second time, not a third
  assert.equal(mayAsk(once, 7, start + ANY_ASK_GAP_MS), true);
  const twice = rememberAsked(once, 7, start + ANY_ASK_GAP_MS);
  assert.equal(mayAsk(twice, 7, start + 2 * ANY_ASK_GAP_MS), false);
  // A day after the first question: once more
  assert.equal(mayAsk(twice, 7, start + SAME_VENUE_DAY_MS), true);
  // Old questions are forgotten
  const later = start + 2 * SAME_VENUE_DAY_MS;
  assert.deepEqual(rememberAsked(twice, 8, later), { 8: [later] });
});

test('the text mentions earlier check-ins', () => {
  assert.equal(suggestionText('Mado', 0).title, 'Mado yakınındasın');
  assert.match(suggestionText('Mado', 3).body, /Daha önce 3 kez check-in yaptın/);
});
