/**
 * Prototype accounts kept only on this phone. The password itself is never
 * stored: only a salted SHA-256 hash. Not a substitute for a real server-side
 * account system.
 */
import type { Role } from './auth.ts';
import { DEFAULT_PLAN, type PlanId } from './plans.ts';

export type Account = {
  name: string;
  salt: string;
  hash: string;
  role?: Role;
  venueId?: number | null;
  plan?: PlanId;
  venueVerified?: boolean;
};
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
  role: Role = 'personal',
): Promise<{ accounts: Accounts; error: null } | { accounts: null; error: string }> {
  const key = normalizeEmail(email);
  if (accounts[key]) {
    return { accounts: null, error: 'Bu e-posta zaten kayıtlı. Giriş yapmayı dene.' };
  }
  const account: Account = {
    name: name.trim(),
    salt,
    hash: await hashPassword(hash, salt, password),
    role,
    ...(role === 'business' ? { venueId: null, plan: DEFAULT_PLAN } : {}),
  };
  return { accounts: { ...accounts, [key]: account }, error: null };
}

export async function checkLogin(
  accounts: Accounts,
  email: string,
  password: string,
  hash: HashFn,
  expectedRole?: Role,
): Promise<{ account: Account; error: null } | { account: null; error: string }> {
  const account = accounts[normalizeEmail(email)];
  if (!account) {
    return { account: null, error: 'Bu e-postayla kayıtlı hesap yok. Önce kayıt ol.' };
  }
  if ((await hashPassword(hash, account.salt, password)) !== account.hash) {
    return { account: null, error: 'Şifre hatalı.' };
  }
  const role = account.role ?? 'personal';
  if (expectedRole && role !== expectedRole) {
    return {
      account: null,
      error:
        role === 'business'
          ? 'Bu e-posta işletme hesabı olarak kayıtlı. Yukarıdan "İşletme"yi seç.'
          : 'Bu e-posta bireysel hesap olarak kayıtlı. Yukarıdan "Bireysel"i seç.',
    };
  }
  return { account, error: null };
}

/** Change stored profile fields (venue, plan) of an existing account. */
export function updateAccount(
  accounts: Accounts,
  email: string,
  patch: Partial<Pick<Account, 'venueId' | 'plan' | 'venueVerified'>>,
): Accounts {
  const key = normalizeEmail(email);
  return accounts[key] ? { ...accounts, [key]: { ...accounts[key], ...patch } } : accounts;
}

export async function changePassword(
  accounts: Accounts,
  email: string,
  oldPassword: string,
  newPassword: string,
  salt: string,
  hash: HashFn,
): Promise<{ accounts: Accounts; error: null } | { accounts: null; error: string }> {
  const key = normalizeEmail(email);
  const account = accounts[key];
  if (!account || (await hashPassword(hash, account.salt, oldPassword)) !== account.hash) {
    return { accounts: null, error: 'Mevcut şifre hatalı.' };
  }
  const updated = { ...account, salt, hash: await hashPassword(hash, salt, newPassword) };
  return { accounts: { ...accounts, [key]: updated }, error: null };
}

export function renameAccount(accounts: Accounts, email: string, name: string): Accounts {
  const key = normalizeEmail(email);
  return accounts[key] ? { ...accounts, [key]: { ...accounts[key], name: name.trim() } } : accounts;
}

export function deleteAccount(accounts: Accounts, email: string): Accounts {
  const { [normalizeEmail(email)]: _removed, ...rest } = accounts;
  return rest;
}
