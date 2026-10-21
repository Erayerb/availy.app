import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateLogin, validateRegister } from '../src/lib/auth.ts';

test('validateLogin accepts a valid email and long enough password', () => {
  assert.equal(validateLogin('eray@example.com', '123456'), null);
  assert.equal(validateLogin('  eray@example.com ', '123456'), null);
});

test('validateLogin takes the user name too, and rejects a short password', () => {
  assert.equal(validateLogin('eray', '123456'), null);
  assert.equal(validateLogin('@Eray', '123456'), null);
  assert.equal(validateLogin('a b', '123456'), 'Kullanıcı adını ya da e-postanı gir.');
  assert.equal(validateLogin('eray@example.com', '123'), 'Şifre en az 6 karakter olmalı.');
});

test('validateRegister needs no name: user name, e-mail and password', () => {
  assert.equal(validateRegister('eray@example.com', '123456', 'eray'), null);
  assert.equal(validateRegister('eray', '123456', 'eray'), 'Geçerli bir e-posta gir.');
});

test('user names: 3-20 of a-z, digits, dot, underscore; "@" and capitals are tidied', async () => {
  const { normalizeUsername, validateUsername } = await import('../src/lib/auth.ts');
  assert.equal(normalizeUsername(' @Eray_42 '), 'eray_42');
  assert.equal(validateUsername('eray'), null);
  assert.match(validateRegister('eray@example.com', '123456', 'ab') ?? '', /Kullanıcı adı/);
  for (const bad of ['ab', 'ayşe', 'a b', '_eray', 'x'.repeat(21)]) assert.notEqual(validateUsername(bad), null);
});
