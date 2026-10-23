import { useCallback, useEffect, useRef, useState } from 'react';

import { accountApi, ApiError, toUser, type LocalBusiness } from '../lib/accountApi';
import { accountKey, normalizeUsername, validateUsername, type Role, type User } from '../lib/auth';
import { moveAccountData } from '../lib/accountData';
import { isLocalVenueId } from '../lib/localVenues';
import { KEYS, loadJson, remove, saveJson } from '../lib/storage';

const asMessage = (e: unknown) => (e instanceof Error ? e.message : 'Bilinmeyen hata');

/** A business's venue on the server; venues added only on this phone are not there. */
async function syncVenue(token: string, venueId: number) {
  if (isLocalVenueId(venueId)) return;
  await accountApi.setVenue(token, venueId).catch(() => {});
}

/** Accounts on the server (v2). Actions resolve to an error message, or null on success. */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  // "Beni hatırla" off: the session lives only in memory and ends when the app is closed
  const remember = useRef(true);
  const sessionUser = useRef<User | null>(null);

  const signIn = useCallback(async (next: User) => {
    // Same account with a new e-mail (changed here or on another phone): keep its data on this phone
    const previous = sessionUser.current ?? (await loadJson<User>(KEYS.user));
    if (previous && previous.id === next.id && accountKey(previous) !== accountKey(next)) {
      await moveAccountData(accountKey(previous), accountKey(next));
    }
    setUser(next);
    sessionUser.current = next;
    if (remember.current) await saveJson(KEYS.user, next);
    else await remove(KEYS.user);
  }, []);

  const signOutLocally = useCallback(async () => {
    setUser(null);
    sessionUser.current = null;
    remember.current = true;
    await remove(KEYS.user);
  }, []);

  // Business details still kept on this phone, per account id
  const localBusiness = async (id: number): Promise<LocalBusiness> =>
    ((await loadJson<Record<string, LocalBusiness>>(KEYS.businessProfiles)) ?? {})[id] ?? {};

  useEffect(() => {
    loadJson<User>(KEYS.user).then(async (stored) => {
      // Businesses that chose their venue before it was kept on the server
      if (stored?.token && stored.role === 'business' && stored.venueId) syncVenue(stored.token, stored.venueId);
      // v1 users lived only on the phone and have no server session: they sign in again
      if (stored?.token) setUser(stored);
      else if (stored) await remove(KEYS.user);
      setReady(true);
      if (!stored?.token) return;
      // Refresh from the server; an expired or deleted session signs the user out
      try {
        const fresh = await accountApi.me(stored.token);
        await signIn(toUser(fresh, stored.token, await localBusiness(fresh.id)));
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) await signOutLocally();
      }
    });
  }, [signIn, signOutLocally]);

  /** Reload profile and points from the server (e.g. after a check-in). */
  const refreshMe = useCallback(async () => {
    const stored = sessionUser.current ?? (await loadJson<User>(KEYS.user));
    if (!stored?.token) return;
    try {
      const fresh = await accountApi.me(stored.token);
      await signIn(toUser(fresh, stored.token, await localBusiness(fresh.id)));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await signOutLocally();
    }
  }, [signIn, signOutLocally]);

  // Points and badges come only from /v1/me: load them once someone signs in
  useEffect(() => {
    if (user?.token && user.points === undefined) refreshMe();
  }, [user?.token, user?.points, refreshMe]);

  const register = useCallback(
    async (username: string, email: string, password: string, role: Role, invitedBy: string | null = null): Promise<string | null> => {
      try {
        if (user?.isGuest && user.token) {
          // A guest signs up: same account, so check-ins and points stay
          const upgraded = await accountApi.upgrade(user.token, username, email, password, role, invitedBy);
          await signIn(toUser(upgraded, user.token, await localBusiness(upgraded.id)));
        } else {
          const session = await accountApi.register(username, email, password, role, invitedBy);
          await signIn(toUser(session.user, session.token));
        }
        return null;
      } catch (e) {
        return asMessage(e);
      }
    },
    [user, signIn],
  );

  const login = useCallback(
    async (login: string, password: string, role: Role, rememberMe = true): Promise<string | null> => {
      try {
        const started = await accountApi.login(login, password, role);
        remember.current = rememberMe;
        // Also fills in the user name next time
        if (rememberMe) await saveJson(KEYS.lastLogin, login.trim());
        else await remove(KEYS.lastLogin);
        await signIn(toUser(started.user, started.token, await localBusiness(started.user.id)));
        return null;
      } catch (e) {
        return asMessage(e);
      }
    },
    [signIn],
  );

  /** "Kayıt olmadan devam et": the server opens a guest account with an automatic id. */
  const continueAsGuest = useCallback(async (): Promise<string | null> => {
    try {
      const session = await accountApi.guest();
      await signIn(toUser(session.user, session.token));
      return null;
    } catch (e) {
      return asMessage(e);
    }
  }, [signIn]);

  /** Save business profile changes (claimed venue, plan); kept on this phone for now. */
  const updateProfile = useCallback(
    async (patch: Partial<LocalBusiness>) => {
      if (!user) return;
      await signIn({ ...user, ...patch });
      if (patch.venueId && user.token && user.role === 'business') await syncVenue(user.token, patch.venueId);
      if (user.id === undefined) return;
      const all = (await loadJson<Record<string, LocalBusiness>>(KEYS.businessProfiles)) ?? {};
      await saveJson(KEYS.businessProfiles, { ...all, [user.id]: { ...all[user.id], ...patch } });
    },
    [user, signIn],
  );

  /** New user name (also the display name); resolves to an error message, or null on success. */
  const changeUsername = useCallback(
    async (username: string): Promise<string | null> => {
      if (!user?.token) return 'Önce giriş yap.';
      const problem = validateUsername(username);
      if (problem) return problem;
      try {
        const fresh = await accountApi.changeUsername(user.token, normalizeUsername(username));
        await signIn({ ...user, name: fresh.name, username: fresh.username });
        return null;
      } catch (e) {
        return asMessage(e);
      }
    },
    [user, signIn],
  );

  const changePassword = useCallback(
    async (oldPassword: string, newPassword: string): Promise<string | null> => {
      if (!user?.token) return 'Giriş yapılmamış.';
      try {
        await accountApi.changePassword(user.token, oldPassword, newPassword);
        return null;
      } catch (e) {
        return asMessage(e);
      }
    },
    [user],
  );

  /** KVKK: deletes the account on the server; its check-ins stay only as anonymous reports. */
  const deleteAccount = useCallback(async () => {
    if (user?.token) await accountApi.remove(user.token).catch(() => {});
    await signOutLocally();
  }, [user, signOutLocally]);

  const changeEmail = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      if (!user?.token) return 'Önce giriş yap.';
      try {
        const fresh = await accountApi.changeEmail(user.token, email, password);
        // A new address has to be verified again
        await signIn({ ...user, email: fresh.email, emailVerified: fresh.email_verified ?? false });
        return null;
      } catch (e) {
        return asMessage(e);
      }
    },
    [user, signIn],
  );

  /** E-mail verification: send the code (again), then enter it. */
  const sendVerification = useCallback(async (): Promise<string | null> => {
    if (!user?.token) return 'Önce giriş yap.';
    try {
      await accountApi.sendVerification(user.token);
      return null;
    } catch (e) {
      return asMessage(e);
    }
  }, [user]);

  const verifyEmail = useCallback(
    async (code: string): Promise<string | null> => {
      if (!user?.token) return 'Önce giriş yap.';
      try {
        await accountApi.verifyEmail(user.token, code);
        await signIn({ ...user, emailVerified: true });
        return null;
      } catch (e) {
        return asMessage(e);
      }
    },
    [user, signIn],
  );

  /** "Hesabı dondur": the server signs out every session, so only this phone is cleared here. */
  const freezeAccount = useCallback(async (): Promise<string | null> => {
    if (!user?.token) return 'Önce giriş yap.';
    try {
      await accountApi.freeze(user.token);
      await signOutLocally();
      return null;
    } catch (e) {
      return asMessage(e);
    }
  }, [user, signOutLocally]);

  const logout = useCallback(async () => {
    if (user?.token) await accountApi.logout(user.token).catch(() => {});
    await signOutLocally();
  }, [user, signOutLocally]);

  return {
    user,
    ready,
    login,
    register,
    continueAsGuest,
    refreshMe,
    updateProfile,
    changeUsername,
    changePassword,
    changeEmail,
    sendVerification,
    verifyEmail,
    deleteAccount,
    freezeAccount,
    logout,
  };
}
