import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateLogin, validateRegister } from '../src/lib/auth.ts';

test('validateLogin accepts a valid email and long enough password', () => {
  assert.equal(validateLogin('eray@example.com', '123456'), null);
  assert.equal(validateLogin('  eray@example.com ', '123456'), null);
});

test('validateLogin rejects bad email or short password', () => {
  assert.equal(validateLogin('eray', '123456'), 'Geçerli bir e-posta gir.');
  assert.equal(validateLogin('eray@example.com', '123'), 'Şifre en az 6 karakter olmalı.');
});

test('validateRegister requires a name', () => {
  assert.equal(validateRegister(' ', 'eray@example.com', '123456', 'eray'), 'Adını gir.');
  assert.equal(validateRegister('Eray', 'eray@example.com', '123456', 'eray'), null);
});

test('user names: 3-20 of a-z, digits, dot, underscore; "@" and capitals are tidied', async () => {
  const { normalizeUsername, validateUsername } = await import('../src/lib/auth.ts');
  assert.equal(normalizeUsername(' @Eray_42 '), 'eray_42');
  assert.equal(validateUsername('eray'), null);
  assert.match(validateRegister('Eray', 'eray@example.com', '123456', 'ab') ?? '', /Kullanıcı adı/);
  for (const bad of ['ab', 'ayşe', 'a b', '_eray', 'x'.repeat(21)]) assert.notEqual(validateUsername(bad), null);
});
