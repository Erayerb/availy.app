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
  assert.equal(validateRegister(' ', 'eray@example.com', '123456'), 'Adını gir.');
  assert.equal(validateRegister('Eray', 'eray@example.com', '123456'), null);
});
