import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import { checkLogin, createAccount, type Accounts } from '../src/lib/accounts.ts';

// Same algorithm the app uses (expo-crypto SHA-256, hex)
const sha256 = async (text: string) => createHash('sha256').update(text).digest('hex');

async function registered(): Promise<Accounts> {
  const result = await createAccount({}, ' Eray ', 'Eray@Example.com ', 'gizli123', 'salt-1', sha256);
  assert.equal(result.error, null);
  return result.accounts!;
}

test('register stores a salted hash, never the password', async () => {
  const accounts = await registered();
  const account = accounts['eray@example.com'];
  assert.equal(account.name, 'Eray');
  assert.equal(account.hash, await sha256('salt-1:gizli123'));
  assert.ok(!JSON.stringify(accounts).includes('gizli123'));
});

test('login succeeds only with the right password', async () => {
  const accounts = await registered();
  assert.deepEqual(await checkLogin(accounts, 'eray@example.com', 'gizli123', sha256), {
    name: 'Eray',
    error: null,
  });
  assert.equal((await checkLogin(accounts, 'eray@example.com', 'yanlis123', sha256)).error, 'Şifre hatalı.');
});

test('login email is case and space insensitive', async () => {
  const accounts = await registered();
  assert.equal((await checkLogin(accounts, '  ERAY@example.com', 'gizli123', sha256)).error, null);
});

test('login fails for an unknown email', async () => {
  const result = await checkLogin({}, 'kimse@example.com', 'gizli123', sha256);
  assert.equal(result.error, 'Bu e-postayla kayıtlı hesap yok. Önce kayıt ol.');
});

test('registering the same email twice is rejected', async () => {
  const accounts = await registered();
  const again = await createAccount(accounts, 'Başka', 'eray@example.com', 'baska123', 'salt-2', sha256);
  assert.equal(again.error, 'Bu e-posta zaten kayıtlı. Giriş yapmayı dene.');
});
