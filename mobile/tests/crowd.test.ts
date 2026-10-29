import assert from 'node:assert/strict';
import { test } from 'node:test';

import { crowdRatioText, crowdScore, crowdSummary, liveLevel, shortDate, timeAgo, UNEXPLORED } from '../src/lib/crowd.ts';

const NOW = new Date('2026-10-20T12:00:00Z');
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();
const live = { state: 'live' as const, level: 'high' as const, ratio: 0.82, reporters: 6, last_report_at: ago(12), queue: true, seats: null };

test('time ago in Turkish', () => {
  assert.equal(timeAgo(ago(0), NOW), 'az önce');
  assert.equal(timeAgo(ago(12), NOW), '12 dk önce');
  assert.equal(timeAgo(ago(185), NOW), '3 saat önce');
  assert.equal(timeAgo(ago(60 * 50), NOW), '2 gün önce');
});

test('summary line for each state', () => {
  assert.equal(crowdSummary(live, NOW), 'Son bildirim 12 dk önce · 6 kişi');
  assert.equal(crowdSummary({ ...UNEXPLORED, state: 'stale', last_report_at: ago(180) }, NOW), 'Son bildirim 3 saat önce');
  assert.match(crowdSummary(UNEXPLORED, NOW), /İlk check-in'i sen yap/);
});

test('percent only with enough people, extras from the follow-up answers', () => {
  assert.equal(crowdRatioText(live), '~%82');
  assert.equal(crowdRatioText({ ...live, ratio: null }), null);
});

test('level and sort score only for open venues with fresh check-ins', () => {
  assert.equal(liveLevel({ open_now: true, crowd: live }), 'high');
  assert.equal(liveLevel({ open_now: false, crowd: live }), null);
  assert.equal(liveLevel({ open_now: true, crowd: UNEXPLORED }), null);
  assert.equal(crowdScore({ open_now: true, crowd: { ...live, ratio: null, level: 'low' } }), 0.2);
  assert.equal(crowdScore({ open_now: true, crowd: UNEXPLORED }), Infinity);
});

test('check-in body: only the answer of the chosen level is sent', async () => {
  const { checkinBody, followUpQuestion } = await import('../src/lib/checkinApi.ts');
  const at = { lat: 41, lon: 29 };
  assert.equal(followUpQuestion('high')?.text, 'Sıra var mı?');
  assert.equal(followUpQuestion('medium')?.text, 'Oturacak yer var mı?');
  assert.equal(followUpQuestion('low'), null);
  assert.deepEqual(checkinBody('high', true, at), { level: 'high', queue: true, seats: null, ...at, private: false });
  assert.deepEqual(checkinBody('medium', false, at), { level: 'medium', queue: null, seats: false, ...at, private: false });
  assert.deepEqual(checkinBody('low', true, at), { level: 'low', queue: null, seats: null, ...at, private: false });
});

test('check-in message: points, explorer note, "keşfeden 12. kişi", visit count', async () => {
  const { checkinMessage } = await import('../src/lib/checkinApi.ts');
  const base = { is_first: false, points_earned: 10, visitor_rank: null, my_visits: 3 };
  assert.match(checkinMessage({ ...base, is_first: true, points_earned: 60, visitor_rank: 1, my_visits: 1 }), /^\+60 puan · Kâşif rozeti kazandın$/);
  assert.equal(checkinMessage({ ...base, visitor_rank: 12, my_visits: 1 }), '+10 puan · Burayı keşfeden 12. kişisin!');
  assert.equal(checkinMessage(base), "+10 puan · Buraya 3. check-in'in");
  assert.equal(checkinMessage({ ...base, points_earned: 20, first_today: true }), '+20 puan · Bugünün ilk bilgisi senden, 2 kat puan!');
  assert.match(checkinMessage({ ...base, points_earned: 0, points_note: 'too_soon' }), /30 dakikada.*puan yok/);
  assert.match(checkinMessage({ ...base, points_earned: 0, points_note: 'daily_limit' }), /günde 8/);
});

test('private check-ins are marked in the request', async () => {
  const { checkinBody } = await import('../src/lib/checkinApi.ts');
  assert.equal(checkinBody('low', null, { lat: 41, lon: 29 }, true).private, true);
  assert.equal(checkinBody('low', null, { lat: 41, lon: 29 }).private, false);
});

test('a level only one person reported is tentative', async () => {
  const { isTentative } = await import('../src/lib/crowd.ts');
  const { fadeColor } = await import('../src/lib/occupancy.ts');
  assert.equal(isTentative({ open_now: true, crowd: { ...live, reporters: 1 } }), true);
  assert.equal(isTentative({ open_now: true, crowd: { ...live, reporters: 2 } }), false);
  assert.equal(isTentative({ open_now: false, crowd: { ...live, reporters: 1 } }), false);
  assert.equal(fadeColor('#000000'), '#808080');
  assert.equal(fadeColor('#D9480F', 0), '#d9480f');
});

test('no fresh check-ins: how full it was at this time yesterday', async () => {
  const { crowdYesterday } = await import('../src/lib/crowd.ts');
  const stale = { ...live, state: 'stale' as const, level: null, ratio: null };
  assert.equal(crowdYesterday({ ...stale, yesterday_level: 'high' }), 'Dün bu saatlerde kalabalıktı');
  assert.equal(crowdYesterday({ ...stale, yesterday_level: null }), null);
  assert.equal(crowdYesterday({ ...live, yesterday_level: 'low' }), null);
});

test('shortDate: the time only today', () => {
  const now = new Date(2026, 9, 25, 15, 0);
  assert.equal(shortDate(new Date(2026, 9, 25, 13, 10).toISOString(), now), 'Bugün 13:10');
  assert.equal(shortDate(new Date(2026, 9, 24, 9, 5).toISOString(), now), 'Dün');
  assert.equal(shortDate(new Date(2026, 9, 23, 18, 40).toISOString(), now), '23 Eki');
  assert.match(shortDate(new Date(2025, 11, 30, 8, 0).toISOString(), now), /2025/);
});

test('"Bugünün ilk bilgisini sen ver": open, discovered, nothing since midnight', async () => {
  const { firstOfDayOpen } = await import('../src/lib/checkinApi.ts');
  const now = new Date(2026, 9, 29, 15, 0);
  const at = (d: number, h: number) => new Date(2026, 9, d, h).toISOString();
  assert.equal(firstOfDayOpen({ open_now: true, crowd: { last_report_at: at(28, 20) } }, now), true);
  assert.equal(firstOfDayOpen({ open_now: true, crowd: { last_report_at: at(29, 9) } }, now), false);
  assert.equal(firstOfDayOpen({ open_now: false, crowd: { last_report_at: at(28, 20) } }, now), false);
  assert.equal(firstOfDayOpen({ open_now: true, crowd: { last_report_at: null } }, now), false); // the discovery bonus instead
});
