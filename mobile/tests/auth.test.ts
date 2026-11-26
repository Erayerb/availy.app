import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateLogin, validateRegister } from '../src/lib/auth.ts';

test('validateLogin accepts a valid email and any password (older ones may be short)', () => {
  assert.equal(validateLogin('eray@example.com', '123456'), null);
  assert.equal(validateLogin('  eray@example.com ', '123'), null);
  assert.equal(validateLogin('eray@example.com', ''), 'Şifreni gir.');
});

test('validateLogin takes the user name too', () => {
  assert.equal(validateLogin('eray', '123456'), null);
  assert.equal(validateLogin('@Eray', '123456'), null);
  assert.equal(validateLogin('a b', '123456'), 'Kullanıcı adını ya da e-postanı gir.');
});

test('validateRegister needs no name: user name, e-mail and a strong password', () => {
  assert.equal(validateRegister('eray@example.com', 'Gizli.123', 'eray'), null);
  assert.equal(validateRegister('eray', 'Gizli.123', 'eray'), 'Geçerli bir e-posta gir.');
  assert.equal(validateRegister('eray@example.com', '123456', 'eray'), 'Şifre en az 8 karakter olmalı.');
});

test('new passwords: 8+ with upper, lower, digit and punctuation (the same messages as the server)', async () => {
  const { passwordProblem } = await import('../src/lib/auth.ts');
  assert.equal(passwordProblem('gizlisifre'), 'Şifrede bir büyük harf, bir rakam ve bir noktalama işareti (. ! ? gibi) olmalı.');
  assert.equal(passwordProblem('Gizlisifre1'), 'Şifrede bir noktalama işareti (. ! ? gibi) olmalı.');
  assert.equal(passwordProblem('İSTANBUL.34'), 'Şifrede bir küçük harf olmalı.');
  assert.equal(passwordProblem('Gizli.123'), null);
});

test('user names: 3-20 of a-z, digits, dot, underscore; "@" and capitals are tidied', async () => {
  const { normalizeUsername, validateUsername } = await import('../src/lib/auth.ts');
  assert.equal(normalizeUsername(' @Eray_42 '), 'eray_42');
  assert.equal(validateUsername('eray'), null);
  assert.match(validateRegister('eray@example.com', 'Gizli.123', 'ab') ?? '', /Kullanıcı adı/);
  for (const bad of ['ab', 'ayşe', 'a b', '_eray', 'x'.repeat(21)]) assert.notEqual(validateUsername(bad), null);
});
