import assert from 'node:assert/strict';
import { test } from 'node:test';

import { friendQrPayload, inviteFromQuery, inviteLink, inviteMessage, parseFriendCode, placesFromFriends } from '../src/lib/friends.ts';

test('friend QR codes, invite links and typed names all give the user name', () => {
  assert.equal(parseFriendCode(friendQrPayload('eray')), 'eray');
  assert.equal(parseFriendCode(inviteLink('eray_42')), 'eray_42');
  assert.equal(parseFriendCode(' @Eray '), 'eray');
  assert.equal(parseFriendCode('availy:customer:M-123456'), null);
  assert.equal(parseFriendCode('https://example.com'), null);
});

test('invite link and message', () => {
  assert.equal(inviteLink('eray'), 'https://erayerb.github.io/availy.app/v2/?invite=eray');
  assert.match(inviteMessage('eray'), /@eray\. .*ikimize de 50 puan\. https:\/\/erayerb\.github\.io\/availy\.app\/v2\/\?invite=eray$/);
  assert.equal(inviteFromQuery('?invite=eray'), 'eray');
  assert.equal(inviteFromQuery('?venue=Kafe'), null);
});

test('places friends went lately: one per place, newest first, old visits left out', () => {
  const now = new Date('2026-11-14T12:00:00Z');
  const friend = (id: number, venue_id: number, at: string) => ({
    id, username: `u${id}`, name: '', last_checkin: { venue_id, venue_name: 'x', at, is_first: false, points: 0 },
  });
  const places = placesFromFriends(
    [
      friend(1, 10, '2026-11-14T09:00:00Z'),
      friend(2, 20, '2026-11-13T09:00:00Z'),
      friend(3, 10, '2026-11-14T11:00:00Z'),
      friend(4, 30, '2026-11-01T09:00:00Z'),
      { id: 5, username: 'u5', name: '', last_checkin: null },
    ],
    now,
  );
  assert.deepEqual(places.map((p) => [p.venueId, p.people.length, p.at]), [
    [10, 2, '2026-11-14T11:00:00Z'],
    [20, 1, '2026-11-13T09:00:00Z'],
  ]);
});
