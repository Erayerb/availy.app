/** Signed-in user and form validation. Accounts themselves: see accounts.ts. */
export type User = { name: string; email: string };

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
