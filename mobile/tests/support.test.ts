import assert from 'node:assert/strict';
import { test } from 'node:test';

import { couponQrPayload, parseCouponQr } from '../src/lib/coupons.ts';
import { addSupportMessage, validateSupport, type SupportMessage } from '../src/lib/support.ts';

test('bug reports need some text; e-mail is optional but must be valid', () => {
  assert.match(validateSupport('bug', 'kısa', '') ?? '', /En az/);
  assert.equal(validateSupport('bug', 'Harita açılmıyor, boş ekran', ''), null);
  assert.match(validateSupport('bug', 'Harita açılmıyor, boş ekran', 'yanlis') ?? '', /e-posta/);
  assert.match(validateSupport('bug', 'x'.repeat(1001), '') ?? '', /En fazla/);
});

test('contact messages need an e-mail to reply to', () => {
  assert.match(validateSupport('contact', 'İş birliği yapmak istiyoruz', '') ?? '', /e-posta/);
  assert.equal(validateSupport('contact', 'İş birliği yapmak istiyoruz', 'a@b.co'), null);
});

test('only the latest 50 messages are kept, newest first', () => {
  const make = (i: number): SupportMessage => ({
    id: String(i),
    kind: 'bug',
    topic: 'Öneri',
    text: 'mesaj metni burada',
    email: '',
    createdAt: '2026-10-15T10:00:00Z',
  });
  let list: SupportMessage[] = [];
  for (let i = 0; i < 55; i++) list = addSupportMessage(list, make(i));
  assert.equal(list.length, 50);
  assert.equal(list[0].id, '54');
});

test('coupon QR codes round-trip and other codes are rejected', () => {
  assert.equal(parseCouponQr(couponQrPayload('AV-7K3P')), 'AV-7K3P');
  assert.equal(parseCouponQr(' av-7k3p '), 'AV-7K3P');
  assert.equal(parseCouponQr('availy:customer:M-123456'), null);
  assert.equal(parseCouponQr('https://example.com'), null);
});

test('free users can watch one venue, Premium users any number', async () => {
  const { canAddWatch } = await import('../src/lib/premium.ts');
  assert.equal(canAddWatch(0, false), true);
  assert.equal(canAddWatch(1, false), false);
  assert.equal(canAddWatch(5, true), true);
});

test('"Tekrar gönder" copies the campaign with its planned length', async () => {
  const { createCampaign, repeatCampaign } = await import('../src/lib/campaigns.ts');
  const base = { venueId: 1, venueName: 'Kafe', lat: 41, lon: 29, message: 'Kahveler %20 indirimli', discount: 20, radiusKm: 2, maxClaims: 25 };
  const first = createCampaign({ ...base, durationHours: 3 }, new Date('2026-10-14T10:00:00Z'), 'a');
  // Ended early, after 10 minutes
  const ended = { ...first, endsAt: '2026-10-14T10:10:00Z' };
  assert.deepEqual(repeatCampaign(ended), { ...base, durationHours: 3 });
  // Older campaigns without the field fall back to start..end (at least 1 hour)
  const { durationHours: _, ...old } = ended;
  assert.equal(repeatCampaign(old).durationHours, 1);
});
