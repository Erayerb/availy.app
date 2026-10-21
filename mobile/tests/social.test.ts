import assert from 'node:assert/strict';
import { test } from 'node:test';

import { notificationText, unreadCount, type AppNotification } from '../src/lib/social.ts';

const n = (kind: AppNotification['kind'], at: string): AppNotification => ({
  kind,
  at,
  username: 'ayse',
  venue_id: 1,
  venue_name: 'Mado',
  body: 'Katılıyorum',
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
});
