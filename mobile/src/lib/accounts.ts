/**
 * Prototype accounts kept only on this phone. The password itself is never
 * stored: only a salted SHA-256 hash. Not a substitute for a real server-side
 * account system.
 */
export type Account = { name: string; salt: string; hash: string };
export type Accounts = Record<string, Account>; // key: normalized email

export type HashFn = (text: string) => Promise<string>;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const hashPassword = (hash: HashFn, salt: string, password: string) => hash(`${salt}:${password}`);

export async function createAccount(
  accounts: Accounts,
  name: string,
  email: string,
  password: string,
  salt: string,
  hash: HashFn,
): Promise<{ accounts: Accounts; error: null } | { accounts: null; error: string }> {
  const key = normalizeEmail(email);
  if (accounts[key]) {
    return { accounts: null, error: 'Bu e-posta zaten kayıtlı. Giriş yapmayı dene.' };
  }
  const account = { name: name.trim(), salt, hash: await hashPassword(hash, salt, password) };
  return { accounts: { ...accounts, [key]: account }, error: null };
}

export async function checkLogin(
  accounts: Accounts,
  email: string,
  password: string,
  hash: HashFn,
): Promise<{ name: string; error: null } | { name: null; error: string }> {
  const account = accounts[normalizeEmail(email)];
  if (!account) {
    return { name: null, error: 'Bu e-postayla kayıtlı hesap yok. Önce kayıt ol.' };
  }
  if ((await hashPassword(hash, account.salt, password)) !== account.hash) {
    return { name: null, error: 'Şifre hatalı.' };
  }
  return { name: account.name, error: null };
}
