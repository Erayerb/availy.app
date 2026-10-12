import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useState } from 'react';

import {
  changePassword as changeStoredPassword,
  checkLogin,
  createAccount,
  deleteAccount as deleteStoredAccount,
  normalizeEmail,
  renameAccount,
  updateAccount,
  type Accounts,
} from '../lib/accounts';
import type { Role, User } from '../lib/auth';
import { KEYS, loadJson, remove, saveJson } from '../lib/storage';

const sha256 = (text: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);

/** Prototype auth against accounts stored on this phone. Returns an error message or null. */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadJson<User>(KEYS.user).then((stored) => {
      setUser(stored);
      setReady(true);
    });
  }, []);

  const signIn = useCallback(async (next: User) => {
    setUser(next);
    await saveJson(KEYS.user, next);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string, role: Role): Promise<string | null> => {
      const accounts = (await loadJson<Accounts>(KEYS.accounts)) ?? {};
      const result = await createAccount(accounts, name, email, password, Crypto.randomUUID(), sha256, role);
      if (result.error !== null) return result.error;
      await saveJson(KEYS.accounts, result.accounts);
      const { venueId, plan, venueVerified } = result.accounts[normalizeEmail(email)];
      await signIn({ name: name.trim(), email: normalizeEmail(email), role, venueId, plan, venueVerified });
      return null;
    },
    [signIn],
  );

  const login = useCallback(
    async (email: string, password: string, role: Role): Promise<string | null> => {
      const accounts = (await loadJson<Accounts>(KEYS.accounts)) ?? {};
      const result = await checkLogin(accounts, email, password, sha256, role);
      if (result.error !== null) return result.error;
      // checkLogin already verified that the account has the chosen role
      const { name, venueId, plan, venueVerified } = result.account;
      await signIn({ name, email: normalizeEmail(email), role, venueId, plan, venueVerified });
      return null;
    },
    [signIn],
  );

  /** Save business profile changes (claimed venue, plan) to the user and their account. */
  const updateProfile = useCallback(
    async (patch: Partial<Pick<User, 'venueId' | 'plan' | 'venueVerified'>>) => {
      if (!user) return;
      const next = { ...user, ...patch };
      await signIn(next);
      const accounts = (await loadJson<Accounts>(KEYS.accounts)) ?? {};
      await saveJson(KEYS.accounts, updateAccount(accounts, user.email, patch));
    },
    [user, signIn],
  );

  const rename = useCallback(
    async (name: string) => {
      if (!user || name.trim().length < 2) return;
      await signIn({ ...user, name: name.trim() });
      const accounts = (await loadJson<Accounts>(KEYS.accounts)) ?? {};
      await saveJson(KEYS.accounts, renameAccount(accounts, user.email, name));
    },
    [user, signIn],
  );

  const changePassword = useCallback(
    async (oldPassword: string, newPassword: string): Promise<string | null> => {
      if (!user) return 'Giriş yapılmamış.';
      const accounts = (await loadJson<Accounts>(KEYS.accounts)) ?? {};
      const result = await changeStoredPassword(accounts, user.email, oldPassword, newPassword, Crypto.randomUUID(), sha256);
      if (result.error !== null) return result.error;
      await saveJson(KEYS.accounts, result.accounts);
      return null;
    },
    [user],
  );

  /** Removes the account from this phone (KVKK: the user can delete their data). */
  const deleteAccount = useCallback(async () => {
    if (!user) return;
    const accounts = (await loadJson<Accounts>(KEYS.accounts)) ?? {};
    await saveJson(KEYS.accounts, deleteStoredAccount(accounts, user.email));
    setUser(null);
    await remove(KEYS.user);
  }, [user]);

  const logout = useCallback(async () => {
    setUser(null);
    await remove(KEYS.user);
  }, []);

  return { user, ready, login, register, updateProfile, rename, changePassword, deleteAccount, logout };
}
