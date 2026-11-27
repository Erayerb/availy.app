import assert from 'node:assert/strict';
import { test } from 'node:test';

import { notificationText, phoneNotificationText, unreadCount, type AppNotification } from '../src/lib/social.ts';

const n = (kind: AppNotification['kind'], at: string): AppNotification => ({
  kind,
  at,
  username: 'ayse',
  venue_id: 1,
  venue_name: 'Mado',
  body: 'Katılıyorum',
  key: `${kind}:${at}`,
});

test('unread notifications are the ones after the last visit', () => {
  const list = [n('reply', '2026-10-21T10:00:00Z'), n('friend_request', '2026-10-20T10:00:00Z')];
  assert.equal(unreadCount(list, null), 2);
  assert.equal(unreadCount(list, '2026-10-21T09:00:00Z'), 1);
  assert.equal(unreadCount(list, '2026-10-22T00:00:00Z'), 0);
  // Same moment written differently by the server and the phone
  assert.equal(unreadCount([n('reply', '2026-10-21T10:00:00+00:00')], '2026-10-21T10:00:00.000Z'), 0);
});

test('notification texts', () => {
  assert.equal(notificationText(n('friend_request', '')), '@ayse seni arkadaş olarak eklemek istiyor.');
  assert.equal(notificationText(n('friend_accepted', '')), '@ayse arkadaşlık isteğini kabul etti.');
  assert.equal(notificationText(n('reply', '')), '@ayse yorumunu yanıtladı (Mado): "Katılıyorum"');
  // Kept after it is acted on
  assert.equal(notificationText({ ...n('friend_request', ''), done: true }), '@ayse ile artık arkadaşsınız.');
  assert.match(notificationText({ ...n('loyalty', ''), done: true }), /Katıldın\.$/);
  // The list shows the icon beside the text; a phone notification has it in the text
  assert.ok(!notificationText(n('reward', '')).startsWith('🎁'));
  assert.ok(phoneNotificationText(n('reward', '')).startsWith('🎁 '));
});

test('a moment photo shows the time left before it disappears', async () => {
  const { timeLeft } = await import('../src/lib/moments.ts');
  const now = new Date('2026-11-14T12:00:00Z');
  assert.equal(timeLeft('2026-11-15T11:00:00Z', now), '23 sa');
  assert.equal(timeLeft('2026-11-14T12:40:00Z', now), '40 dk');
  assert.equal(timeLeft('2026-11-14T11:00:00Z', now), '0 dk');
});

test('a check-in with friends there says so', async () => {
  const { checkinMessage } = await import('../src/lib/checkinApi.ts');
  const base = { is_first: false, points_earned: 10, visitor_rank: null, my_visits: 3, points_note: null, first_today: false };
  assert.equal(checkinMessage(base), "+10 puan · Buraya 3. check-in'in");
  assert.match(checkinMessage({ ...base, together: ['ayse'] }), /@ayse ile birliktesiniz · \+10 puan$/);
});

test('🔔: Bugün, Bu hafta, Daha eski', async () => {
  const { groupByAge } = await import('../src/lib/social.ts');
  const now = new Date(2026, 10, 24, 15, 0);
  const at = (d: number, h = 10) => new Date(2026, 10, d, h, 0).toISOString();
  const groups = groupByAge([{ at: at(24) }, { at: at(23) }, { at: at(18) }, { at: at(17) }, { at: at(1) }], now);
  assert.deepEqual(groups.map((g) => [g.title, g.items.length]), [['Bugün', 1], ['Bu hafta', 2], ['Daha eski', 2]]);
});

test('"Buradayım, gel!" reads "…mekanındaydı" after two hours', () => {
  const call = { kind: 'come_here', at: '2026-11-27T12:00:00Z', username: 'ayse', venue_id: 1, venue_name: 'Mado', body: null, done: false } as unknown as AppNotification;
  assert.equal(notificationText(call, new Date('2026-11-27T13:00:00Z')), '@ayse şu an Mado mekanında: "Buradayım, gel!"');
  assert.equal(notificationText(call, new Date('2026-11-27T14:30:00Z')), '@ayse Mado mekanındaydı.');
});
