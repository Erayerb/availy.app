import assert from 'node:assert/strict';
import { test } from 'node:test';

import { errorMessage, toUser } from '../src/lib/accountApi.ts';
import { accountKey, isRegistered } from '../src/lib/auth.ts';

const server = { id: 12, name: 'Misafir 12', email: null, username: null, role: 'personal' as const, is_guest: true, venue_id: null, plan: null };

test('server errors become Turkish messages', () => {
  assert.equal(errorMessage(401, { detail: 'E-posta ya da şifre hatalı.' }), 'E-posta ya da şifre hatalı.');
  assert.equal(errorMessage(422, { detail: [{ msg: 'field required' }] }), 'Bilgiler eksik ya da geçersiz.');
  assert.equal(errorMessage(500, null), 'Sunucu hatası: 500');
});

test('a guest from the server', () => {
  const user = toUser(server, 'tok');
  assert.equal(user.isGuest, true);
  assert.equal(user.token, 'tok');
  assert.equal(isRegistered(user), false);
  // Guests have no e-mail: their phone data is keyed by id
  assert.equal(accountKey(user), 'guest-12');
});

test('a business keeps the venue chosen on this phone', () => {
  const business = { ...server, is_guest: false, email: 'kafe@example.test', role: 'business' as const };
  const user = toUser(business, 'tok', { venueId: 7, plan: 'saas' });
  assert.equal(user.venueId, 7);
  assert.equal(user.plan, 'saas');
  assert.equal(isRegistered(user), true);
  assert.equal(accountKey(user), 'kafe@example.test');
});
