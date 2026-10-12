import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import { checkLogin, createAccount, updateAccount, type Accounts } from '../src/lib/accounts.ts';

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
  const ok = await checkLogin(accounts, 'eray@example.com', 'gizli123', sha256);
  assert.equal(ok.error, null);
  assert.equal(ok.account?.name, 'Eray');
  assert.equal(ok.account?.role, 'personal');
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

test('business accounts start without a venue on the pay-per-use plan', async () => {
  const result = await createAccount({}, 'Kafe Sahibi', 'kafe@example.com', 'gizli123', 's', sha256, 'business');
  const account = result.accounts!['kafe@example.com'];
  assert.equal(account.role, 'business');
  assert.equal(account.venueId, null);
  assert.equal(account.plan, 'pay_per_use');
  const updated = updateAccount(result.accounts!, 'KAFE@example.com', { venueId: 5, plan: 'saas' });
  assert.equal(updated['kafe@example.com'].venueId, 5);
  assert.equal(updated['kafe@example.com'].plan, 'saas');
  assert.equal(updated['kafe@example.com'].hash, account.hash);
});

test('login checks the chosen account type', async () => {
  const result = await createAccount({}, 'Kafe', 'kafe@example.com', 'gizli123', 's', sha256, 'business');
  const accounts = result.accounts!;
  assert.equal((await checkLogin(accounts, 'kafe@example.com', 'gizli123', sha256, 'business')).error, null);
  assert.equal(
    (await checkLogin(accounts, 'kafe@example.com', 'gizli123', sha256, 'personal')).error,
    'Bu e-posta işletme hesabı olarak kayıtlı. Yukarıdan "İşletme"yi seç.',
  );
  // Older accounts without a role count as personal
  const old = { 'a@example.com': { ...accounts['kafe@example.com'], role: undefined } };
  assert.match((await checkLogin(old, 'a@example.com', 'gizli123', sha256, 'business')).error!, /bireysel/);
});
