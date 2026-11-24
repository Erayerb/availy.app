import assert from 'node:assert/strict';
import { test } from 'node:test';

test('Kuponlarım: old coupons hide a week after', async () => {
  const { shownCoupons } = await import('../src/lib/coupons.ts');
  const now = new Date('2026-11-24T12:00:00Z');
  const base = { campaignId: '1', venueId: 1, venueName: 'X', message: 'm', discount: 10, claimedAt: '2026-11-01T10:00:00Z' };
  const valid = { ...base, code: 'AV-AAAA', redeemedAt: null, endsAt: '2026-11-24T14:00:00Z' };
  const recent = { ...base, code: 'AV-BBBB', redeemedAt: null, endsAt: '2026-11-20T14:00:00Z' };
  const old = { ...base, code: 'AV-CCCC', redeemedAt: null, endsAt: '2026-11-10T14:00:00Z' };
  const usedLongAgo = { ...base, code: 'AV-DDDD', redeemedAt: '2026-11-02T10:00:00Z', endsAt: '2026-11-02T12:00:00Z' };
  assert.deepEqual(shownCoupons([valid, recent, old, usedLongAgo], now).map((c) => c.code), ['AV-AAAA', 'AV-BBBB']);
});
