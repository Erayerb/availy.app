import assert from 'node:assert/strict';
import { test } from 'node:test';

import { amenitiesFor } from '../src/lib/amenities.ts';
import { decideBusinessActions } from '../src/lib/businessMonitor.ts';
import { addFeedback, stars, validateFeedback, venueRating, type Feedback } from '../src/lib/feedback.ts';
import { campaignTotals, computeHistory, weekdayIndex } from '../src/lib/history.ts';
import { isProgramActive } from '../src/lib/loyalty.ts';
import { applyOverride, validateOverride } from '../src/lib/overrides.ts';
import { dueSchedules, istanbulTime, occurrenceKey, validateSchedule, type ScheduledCampaign } from '../src/lib/schedules.ts';
import { codeMatches, verificationCode } from '../src/lib/verification.ts';

// Tuesday 13:30 in Istanbul
const TUESDAY_1330 = new Date('2026-10-13T10:30:00Z');

const venue = {
  id: 1, name: 'Demo Kafe', category: 'cafe', tags: ['socializing'], capacity: 40, lat: 41, lon: 29,
  neighborhood: 'Moda', district: 'Kadıköy', open_now: true, hours: '08:00–23:00', opens_at: '08:00',
  occupancy: { level: 'medium' as const, ratio: 0.5, updated_at: '' }, district_occupancy: { level: 'medium' as const, ratio: 0.5 },
};

test('history: daily averages over opening hours and weekday means', () => {
  const h = computeHistory(3, 1, false, [8, 23], 14, TUESDAY_1330);
  assert.equal(h.daily.length, 14);
  assert.equal(h.daily[13].date, '2026-10-13');
  assert.equal(weekdayIndex('2026-10-13'), 1); // Tuesday
  assert.equal(h.weekday.length, 7);
  assert.ok(computeHistory(3, 0, false, [8, 23], 7, TUESDAY_1330).daily.every((d) => d.ratio === 0));
});

test('campaign totals for the last N days', () => {
  const campaigns = [
    { id: 'a', venueId: 1, startsAt: '2026-10-12T10:00:00Z' },
    { id: 'b', venueId: 1, startsAt: '2026-09-01T10:00:00Z' }, // too old for a week
    { id: 'c', venueId: 2, startsAt: '2026-10-12T10:00:00Z' }, // other venue
  ];
  const coupons = [
    { campaignId: 'a', redeemedAt: null },
    { campaignId: 'a', redeemedAt: '2026-10-12T11:00:00Z' },
    { campaignId: 'b', redeemedAt: null },
  ];
  assert.deepEqual(campaignTotals(campaigns, { a: 30, b: 5 }, coupons, 1, 7, TUESDAY_1330), {
    campaigns: 1, views: 30, claims: 2, redemptions: 1,
  });
  assert.equal(campaignTotals(campaigns, {}, coupons, 1, 60, TUESDAY_1330).claims, 3);
});

test('venue edits: validation and applying hours, capacity, features', () => {
  assert.equal(validateOverride({ capacity: 0 }), 'Kapasite 1 ile 2000 arasında olmalı.');
  assert.equal(validateOverride({ hours: [10, 10] }), 'Açılış ve kapanış saati aynı olamaz.');
  assert.equal(validateOverride({ tags: [] }), 'En az bir amaç seç.');
  assert.equal(validateOverride({ capacity: 60, hours: [7, 2] }), null);
  const edited = applyOverride(venue as never, { capacity: 60, hours: [14, 2], amenities: ['wifi'], description: 'Bahçeli' }, TUESDAY_1330);
  assert.equal(edited.capacity, 60);
  assert.equal(edited.hours, '14:00–02:00');
  assert.equal(edited.open_now, false); // 13:30 is before 14:00
  assert.equal(edited.description, 'Bahçeli');
  assert.deepEqual(amenitiesFor(edited).map((a) => a.label), ['Wi-Fi']);
  assert.equal(applyOverride(venue as never, undefined), venue);
});

const schedule: ScheduledCampaign = {
  id: 's1', venueId: 1, venueName: 'Demo Kafe', lat: 41, lon: 29, message: 'Salı indirimi %20', discount: 20,
  radiusKm: 2, days: [1], startHour: 13, durationHours: 3, active: true,
};

test('scheduled campaign fires once inside its weekly window', () => {
  assert.deepEqual(istanbulTime(TUESDAY_1330), { weekday: 1, hour: 13, date: '2026-10-13' });
  const due = dueSchedules([schedule], new Set(), TUESDAY_1330);
  assert.equal(due.length, 1);
  assert.equal(due[0].campaign.durationHours, 3); // 13:00-16:00 window, started at 13
  assert.equal(due[0].key, occurrenceKey('s1', '2026-10-13'));
  assert.equal(dueSchedules([schedule], new Set([due[0].key]), TUESDAY_1330).length, 0);
  assert.equal(dueSchedules([{ ...schedule, active: false }], new Set(), TUESDAY_1330).length, 0);
  assert.equal(dueSchedules([{ ...schedule, days: [2] }], new Set(), TUESDAY_1330).length, 0);
  assert.equal(dueSchedules([schedule], new Set(), new Date('2026-10-13T14:30:00Z')).length, 0); // 17:30
  assert.equal(validateSchedule({ ...schedule, days: [] }), 'En az bir gün seç.');
});

test('business monitor: dead-hour alert and auto campaign with cool-downs', () => {
  const dead = { open_now: true, occupancy: { ratio: 0.2 } };
  const opts = { deadHourAlerts: true, autoCampaign: true, hasActiveCampaign: false };
  assert.deepEqual(decideBusinessActions(dead, {}, opts, TUESDAY_1330), { alert: true, autoCampaign: true });
  const recent = { lastAlertAt: '2026-10-13T10:00:00Z', lastAutoAt: '2026-10-13T10:00:00Z' };
  assert.deepEqual(decideBusinessActions(dead, recent, opts, TUESDAY_1330), { alert: false, autoCampaign: false });
  assert.equal(decideBusinessActions(dead, {}, { ...opts, hasActiveCampaign: true }, TUESDAY_1330).autoCampaign, false);
  assert.deepEqual(decideBusinessActions({ open_now: false, occupancy: { ratio: 0 } }, {}, opts, TUESDAY_1330), {
    alert: false, autoCampaign: false,
  });
  assert.equal(decideBusinessActions({ open_now: true, occupancy: { ratio: 0.6 } }, {}, opts, TUESDAY_1330).alert, false);
});

test('ownership verification code', () => {
  assert.match(verificationCode(), /^\d{6}$/);
  assert.ok(codeMatches('482913', ' 482 913 '));
  assert.ok(!codeMatches('482913', '482914'));
});

test('feedback: one review per customer, average rating', () => {
  const f = (userKey: string, rating: number): Feedback => ({
    id: userKey + rating, venueId: 1, userKey, userName: userKey, rating, comment: '', createdAt: '',
  });
  let list = addFeedback([], f('a', 5));
  list = addFeedback(list, f('b', 2));
  list = addFeedback(list, f('a', 4)); // replaces a's first review
  assert.deepEqual(venueRating(list, 1), { average: 3, count: 2, items: list });
  assert.equal(venueRating(list, 9).average, null);
  assert.equal(validateFeedback(0, ''), 'Puan seç (1–5).');
  assert.equal(stars(3), '★★★☆☆');
});

test('paused loyalty programs are inactive', () => {
  assert.ok(isProgramActive({ active: undefined } as never));
  assert.ok(!isProgramActive({ active: false } as never));
});

test('a business can rename its venue; the name must be 2–60 characters', () => {
  assert.match(validateOverride({ name: ' A ' }) ?? '', /İşletme adı/);
  assert.equal(validateOverride({ name: 'Yeni Ad Kafe' }), null);
  const renamed = applyOverride({ name: 'Eski Ad', tags: [] } as never, { name: '  Yeni Ad Kafe ' });
  assert.equal(renamed.name, 'Yeni Ad Kafe');
});
