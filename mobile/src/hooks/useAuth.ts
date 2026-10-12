import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useState } from 'react';

import { checkLogin, createAccount, normalizeEmail, type Accounts } from '../lib/accounts';
import type { User } from '../lib/auth';
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
    async (name: string, email: string, password: string): Promise<string | null> => {
      const accounts = (await loadJson<Accounts>(KEYS.accounts)) ?? {};
      const result = await createAccount(accounts, name, email, password, Crypto.randomUUID(), sha256);
      if (result.error !== null) return result.error;
      await saveJson(KEYS.accounts, result.accounts);
      await signIn({ name: name.trim(), email: normalizeEmail(email) });
      return null;
    },
    [signIn],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      const accounts = (await loadJson<Accounts>(KEYS.accounts)) ?? {};
      const result = await checkLogin(accounts, email, password, sha256);
      if (result.error !== null) return result.error;
      await signIn({ name: result.name, email: normalizeEmail(email) });
      return null;
    },
    [signIn],
  );

  const logout = useCallback(async () => {
    setUser(null);
    await remove(KEYS.user);
  }, []);

  return { user, ready, login, register, logout };
}
