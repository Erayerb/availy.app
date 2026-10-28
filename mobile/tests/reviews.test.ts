import assert from 'node:assert/strict';
import { test } from 'node:test';

import { daySections, type FeedItem } from '../src/lib/reviews.ts';

const item = (username: string, at: string, venue = 'Mado', kind: FeedItem['kind'] = 'checkin'): FeedItem => ({
  kind,
  at,
  username,
  venue_id: 1,
  venue_name: venue,
  is_first: false,
  points: 10,
  rating: null,
  body: null,
  review_author: null,
  review_id: null,
  allow_replies: false,
});

test('Akış: a heading per date, older ones under "Daha eski"', () => {
  const now = new Date(2026, 9, 28, 18, 0);
  const at = (day: number, hour: number) => new Date(2026, 9, day, hour).toISOString();
  const sections = daySections(
    [item('me', at(28, 17)), item('me', at(28, 9)), item('me', at(27, 20)), item('me', at(26, 20)), item('me', at(24, 20)), item('me', at(22, 8))],
    now,
  );
  assert.deepEqual(
    sections.map((s) => [s.title, s.items.length]),
    [
      ['Bugün', 2],
      ['Dün', 1],
      [new Date(2026, 9, 26).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }), 1],
      ['Daha eski', 2],
    ],
  );
});
