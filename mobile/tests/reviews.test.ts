import assert from 'node:assert/strict';
import { test } from 'node:test';

import { groupByPerson, type FeedItem } from '../src/lib/reviews.ts';

const item = (username: string, at: string): FeedItem => ({
  kind: 'checkin',
  at,
  username,
  venue_id: 1,
  venue_name: 'Mado',
  is_first: false,
  points: 10,
  rating: null,
  body: null,
  review_author: null,
  review_id: null,
  allow_replies: false,
});

test('the feed is grouped into one block per person in a row', () => {
  const groups = groupByPerson([item('ali', '3'), item('ali', '2'), item('ayse', '1'), item('ali', '0')]);
  assert.deepEqual(
    groups.map((g) => [g.username, g.items.length]),
    [
      ['ali', 2],
      ['ayse', 1],
      ['ali', 1],
    ],
  );
});
