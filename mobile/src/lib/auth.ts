/** Signed-in user and form validation. Accounts live on the server (v2): see accountApi.ts. */
import type { PlanId } from './plans.ts';

export type Role = 'personal' | 'business';

/** A badge from the server's catalog; locked ones have earned = false and show their progress. */
export type Badge = {
  id: string;
  name: string;
  icon: string;
  description: string;
  progress: number;
  target: number;
  earned: boolean;
};

// role/venueId/plan are optional so users stored by older versions still load (as personal)
export type User = {
  id?: number; // server account id (v2)
  token?: string; // session token from the server (v2); users without one must sign in again
  isGuest?: boolean; // "Kayıt olmadan devam et": a server account without e-mail or password
  // From the server (v2): availy points from check-ins, check-in count, venues discovered first, badges
  points?: number;
  checkins?: number;
  discoveries?: number;
  badges?: Badge[];
  name: string;
  email: string | null;
  username?: string | null; // "@eray" (v2); guests have none
  role?: Role;
  venueId?: number | null;
  plan?: PlanId;
  venueVerified?: boolean; // business proved it owns the venue
  emailVerified?: boolean; // the code sent to the e-mail was entered (v2)
};

export const isBusiness = (user: User | null) => user?.role === 'business';

/** Signed up (not a guest): needed for loyalty cards, Premium and similar. */
export const isRegistered = (user: User | null) => user !== null && !user.isGuest;

/** Key of this person's data kept on the phone (coupons, cards, …): e-mail, or the guest's id. */
export const accountKey = (user: User): string => user.email ?? `guest-${user.id}`;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 6;
// Same rule as the server: 3-20 of a-z, 0-9, "." and "_", starting with a letter or digit
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._]{2,19}$/;

export const normalizeUsername = (username: string) => username.trim().replace(/^@/, '').toLowerCase();

export function validateUsername(username: string): string | null {
  return USERNAME_PATTERN.test(normalizeUsername(username))
    ? null
    : 'Kullanıcı adı 3–20 karakter olmalı; yalnızca harf (a-z), rakam, nokta ve alt çizgi.';
}

const validatePassword = (password: string): string | null =>
  password.length < MIN_PASSWORD_LENGTH ? `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.` : null;

/** Sign-in takes the e-mail or the user name. */
export function validateLogin(login: string, password: string): string | null {
  const value = login.trim();
  if (!EMAIL_PATTERN.test(value) && validateUsername(value)) return 'Kullanıcı adını ya da e-postanı gir.';
  return validatePassword(password);
}

/** Sign-up asks only for a user name (no separate name), e-mail and password. */
export function validateRegister(email: string, password: string, username: string): string | null {
  if (validateUsername(username)) return validateUsername(username);
  if (!EMAIL_PATTERN.test(email.trim())) return 'Geçerli bir e-posta gir.';
  return validatePassword(password);
}
