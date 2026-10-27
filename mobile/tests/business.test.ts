import assert from 'node:assert/strict';
import { test } from 'node:test';

import { amenitiesFor } from '../src/lib/amenities.ts';
import { stars } from '../src/lib/feedback.ts';
import { campaignTotals } from '../src/lib/campaigns.ts';
import { isProgramActive } from '../src/lib/loyalty.ts';
import { validateSchedule } from '../src/lib/schedules.ts';
import { codeMatches, verificationCode } from '../src/lib/verification.ts';

// Tuesday 13:30 in Istanbul
const TUESDAY_1330 = new Date('2026-10-13T10:30:00Z');

const venue = {
  id: 1, name: 'Demo Kafe', category: 'cafe', tags: ['socializing'], capacity: 40, lat: 41, lon: 29,
  neighborhood: 'Moda', district: 'Kadıköy', open_now: true, hours: '08:00–23:00', opens_at: '08:00',
  occupancy: { level: 'medium' as const, ratio: 0.5, updated_at: '' }, district_occupancy: { level: 'medium' as const, ratio: 0.5 },
};

test('campaign totals for the last N days', () => {
  const campaigns = [
    { venueId: 1, startsAt: '2026-10-12T10:00:00Z', stats: { views: 30, claims: 2, redemptions: 1 } },
    { venueId: 1, startsAt: '2026-09-01T10:00:00Z', stats: { views: 5, claims: 1, redemptions: 0 } }, // too old for a week
    { venueId: 2, startsAt: '2026-10-12T10:00:00Z', stats: { views: 9, claims: 9, redemptions: 9 } }, // other venue
  ];
  assert.deepEqual(campaignTotals(campaigns, 1, 7, TUESDAY_1330), { campaigns: 1, views: 30, claims: 2, redemptions: 1 });
  assert.equal(campaignTotals(campaigns, 1, 60, TUESDAY_1330).claims, 3);
});

test('ownership verification code', () => {
  assert.match(verificationCode(), /^\d{6}$/);
  assert.ok(codeMatches('482913', ' 482 913 '));
  assert.ok(!codeMatches('482913', '482914'));
});

test('review stars', () => {
  assert.equal(stars(3), '★★★☆☆');
});

test('paused loyalty programs are inactive', () => {
  assert.ok(isProgramActive({ active: undefined } as never));
  assert.ok(!isProgramActive({ active: false } as never));
});

test('panel: busiest hour today and quietest weekday from check-ins', async () => {
  const { busiestHour, quietestWeekday } = await import('../src/lib/business.ts');
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, checkins: hour === 14 ? 3 : hour === 9 ? 1 : 0, level: null }));
  assert.equal(busiestHour(hours), 14);
  assert.equal(busiestHour(hours.map((h) => ({ ...h, checkins: 0 }))), null);
  assert.equal(quietestWeekday([3, 1, 4, 4, 5, 9, 7]), 1);
  assert.equal(quietestWeekday([0, 0, 0, 0, 0, 0, 0]), null);
  // Several days without check-ins: no single quietest day
  assert.equal(quietestWeekday([0, 0, 1, 0, 0, 0, 0]), null);
});

test('scheduled campaign input is checked before it goes to the server', () => {
  const schedule = { message: 'Her salı %20', days: [1], start_hour: 13 };
  assert.equal(validateSchedule(schedule), null);
  assert.equal(validateSchedule({ ...schedule, days: [] }), 'En az bir gün seç.');
  assert.equal(validateSchedule({ ...schedule, start_hour: 24 }), 'Başlangıç saati 0–23 olmalı.');
  assert.equal(validateSchedule({ ...schedule, message: 'kısa' }), 'Kampanya mesajını yaz.');
});
