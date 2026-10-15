import assert from 'node:assert/strict';
import { test } from 'node:test';

import { firstMatch, localForecast, withOpening } from '../src/lib/forecast.ts';

// 2026-10-14 10:02 UTC = 13:02 in Istanbul
const NOW = new Date('2026-10-14T10:02:00Z');

test('local forecast has one point per 5 minutes, starting after now', () => {
  const points = localForecast(1, 1, false, [8, 23], NOW, 2);
  assert.equal(points.length, 24);
  assert.equal(points[0].at, '2026-10-14T10:05:00.000Z');
  assert.equal(points[1].at, '2026-10-14T10:10:00.000Z');
  assert.ok(points.every((p) => p.ratio >= 0 && p.ratio <= 1));
});

test('opening hours decide which points are open', () => {
  // 13:05–15:00 Istanbul: a bar opening at 17:00 is closed, a cafe is open
  assert.ok(localForecast(1, 1, false, [17, 3], NOW, 2).every((p) => !p.open));
  const cafe = localForecast(1, 1, false, [8, 23], NOW, 2);
  assert.ok(cafe.every((p) => p.open));
  assert.ok(withOpening(cafe, [17, 3]).every((p) => !p.open));
});

test('firstMatch finds the first open quiet moment, not before the given time', () => {
  const points = [
    { at: '2026-10-14T10:05:00Z', ratio: 0.5, open: true },
    { at: '2026-10-14T10:10:00Z', ratio: 0.9, open: true },
    { at: '2026-10-14T10:15:00Z', ratio: 0.3, open: false },
    { at: '2026-10-14T10:20:00Z', ratio: 0.6, open: true },
  ];
  const quiet = (p: { ratio: number; open: boolean }) => p.open && p.ratio < 0.7;
  assert.equal(firstMatch(points, quiet, NOW)?.at, '2026-10-14T10:05:00Z');
  assert.equal(firstMatch(points, quiet, new Date('2026-10-14T10:06:00Z'))?.at, '2026-10-14T10:20:00Z');
  assert.equal(firstMatch(points, (p) => p.ratio < 0.1, NOW), null);
});


// Same inputs and results as backend/tests/test_occupancy.py: the backend and the
// serverless web demo must produce identical fake occupancy
test('fake occupancy matches the backend implementation', async () => {
  const { dummyOccupancy } = await import('../src/lib/dummyOccupancy.ts');
  const cases: [number, string, number, boolean, number][] = [
    [1, '2026-10-14T10:02:00Z', 1, false, 0.8],
    [7, '2026-10-14T05:40:00Z', 1.2, false, 0.48],
    [15, '2026-10-14T12:55:00Z', 0.9, false, 0.51],
    [28, '2026-10-16T07:30:00Z', 1, false, 0.47],
    [42, '2026-10-15T20:15:00Z', 0.8, false, 0.23],
    [3, '2026-10-14T01:00:00Z', 1, true, 0.83],
  ];
  for (const [id, at, popularity, busy, expected] of cases) {
    assert.equal(dummyOccupancy(id, new Date(at), popularity, busy).ratio, expected, `${id} ${at}`);
  }
});

test('estimated emptying: first 5 minutes below 75%, or closing first', async () => {
  const { emptyingEstimate, estimateText, EMPTY_THRESHOLD } = await import('../src/lib/forecast.ts');
  const at = (m: number) => new Date(Date.UTC(2026, 9, 14, 12, m)).toISOString(); // 15:mm Istanbul
  const busy = (m: number, ratio: number, open = true) => ({ at: at(m), ratio, open });
  const points = [busy(5, 0.9), busy(10, 0.8), busy(15, 0.74), busy(20, 0.9)];
  assert.deepEqual(emptyingEstimate(points, EMPTY_THRESHOLD), { kind: 'at', at: at(15) });
  assert.equal(estimateText(emptyingEstimate(points, EMPTY_THRESHOLD)), 'Tahmini boşalma: ~15:15');
  // Exactly 75% is still busy
  assert.deepEqual(emptyingEstimate([busy(5, 0.75), busy(10, 0.9)], EMPTY_THRESHOLD), { kind: 'none' });
  assert.equal(estimateText({ kind: 'none' }), 'Tahmini boşalma belli değil');
  assert.deepEqual(emptyingEstimate([busy(5, 0.9), busy(10, 0.2, false)], EMPTY_THRESHOLD), { kind: 'closes' });
});
