/** Signed-in user and form validation. Accounts themselves: see accounts.ts. */
import type { PlanId } from './plans.ts';

export type Role = 'personal' | 'business';

// role/venueId/plan are optional so users stored by older versions still load (as personal)
export type User = {
  name: string;
  email: string;
  role?: Role;
  venueId?: number | null;
  plan?: PlanId;
  venueVerified?: boolean; // business proved it owns the venue
};

export const isBusiness = (user: User | null) => user?.role === 'business';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 6;

export function validateLogin(email: string, password: string): string | null {
  if (!EMAIL_PATTERN.test(email.trim())) return 'Geçerli bir e-posta gir.';
  if (password.length < MIN_PASSWORD_LENGTH) return `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`;
  return null;
}

export function validateRegister(name: string, email: string, password: string): string | null {
  if (name.trim().length < 2) return 'Adını gir.';
  return validateLogin(email, password);
}
