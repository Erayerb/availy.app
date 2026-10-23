/** v2: accounts on the server (sign up, sign in, guest, profile). `send` is shared by other v2 calls. */
import type { Badge, Role, User } from './auth.ts';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type ServerUser = {
  id: number;
  name: string;
  email: string | null; // null for guests
  username: string | null;
  role: Role;
  is_guest: boolean;
  venue_id: number | null;
  plan: string | null;
  email_verified?: boolean;
  customer_code?: string | null; // only from GET /v1/me: "M-123456" for loyalty stamps
  // Only from GET /v1/me
  points?: number;
  checkins?: number;
  discoveries?: number;
  badges?: Badge[];
};

type Session = { token: string; user: ServerUser };

// Business details that still live on this phone (v2 moves the business side to the server later)
export type LocalBusiness = Pick<User, 'venueId' | 'plan' | 'venueVerified'>;

/** Turkish message from a failed response: the server's `detail` text, or a general one. */
export function errorMessage(status: number, data: unknown): string {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return detail;
  if (status === 422) return 'Bilgiler eksik ya da geçersiz.';
  return `Sunucu hatası: ${status}`;
}

/** App user from the server's user, the session token and what this phone keeps for businesses. */
export function toUser(server: ServerUser, token: string, local: LocalBusiness = {}): User {
  return {
    id: server.id,
    token,
    isGuest: server.is_guest,
    name: server.name,
    email: server.email,
    username: server.username,
    role: server.role,
    venueId: server.venue_id ?? local.venueId ?? null,
    plan: (server.plan as User['plan']) ?? local.plan,
    venueVerified: local.venueVerified,
    emailVerified: server.email_verified ?? false,
    customerCode: server.customer_code ?? undefined,
    points: server.points,
    checkins: server.checkins,
    discoveries: server.discoveries,
    badges: server.badges,
  };
}

export async function send<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  if (!API_URL) throw new ApiError('Sunucu adresi tanımlı değil (mobile/.env).', 0);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Sunucuya bağlanılamadı. İnternet bağlantını kontrol et.', 0);
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(errorMessage(response.status, data), response.status);
  return data as T;
}

export const accountApi = {
  // invitedBy: the user name in an invite link; the two become friends and the inviter earns points
  register: (username: string, email: string, password: string, role: Role, invitedBy: string | null = null) =>
    send<Session>('POST', '/v1/auth/register', { username, email, password, role, invited_by: invitedBy }),
  // `login` is the e-mail or the user name
  login: (login: string, password: string, role: Role) => send<Session>('POST', '/v1/auth/login', { login, password, role }),
  guest: () => send<Session>('POST', '/v1/auth/guest'),
  // A guest signs up; same id, the current token stays valid
  upgrade: (token: string, username: string, email: string, password: string, role: Role, invitedBy: string | null = null) =>
    send<ServerUser>('POST', '/v1/auth/upgrade', { username, email, password, role, invited_by: invitedBy }, token),
  logout: (token: string) => send<void>('POST', '/v1/auth/logout', undefined, token),
  me: (token: string) => send<ServerUser>('GET', '/v1/me', undefined, token),
  changeUsername: (token: string, username: string) => send<ServerUser>('PATCH', '/v1/me', { username }, token),
  changePassword: (token: string, oldPassword: string, newPassword: string) =>
    send<void>('POST', '/v1/me/password', { old_password: oldPassword, new_password: newPassword }, token),
  remove: (token: string) => send<void>('DELETE', '/v1/me', undefined, token),
  changeEmail: (token: string, email: string, password: string) =>
    send<ServerUser>('POST', '/v1/me/email', { email, password }, token),
  // "Şifremi unuttum": a 6-digit code by e-mail, then the new password with it
  forgot: (email: string) => send<void>('POST', '/v1/auth/forgot', { email }),
  reset: (email: string, code: string, password: string) => send<void>('POST', '/v1/auth/reset', { email, code, password }),
  // E-mail verification (the code is also sent right after signing up)
  sendVerification: (token: string) => send<void>('POST', '/v1/me/email/code', undefined, token),
  verifyEmail: (token: string, code: string) => send<ServerUser>('POST', '/v1/me/email/verify', { code }, token),
  // Business: its venue on the server (panel statistics, "İşletme" replies)
  setVenue: (token: string, venueId: number) => send<{ venue_id: number }>('PUT', '/v1/me/venue', { venue_id: venueId }, token),
  // Hide the account until the next sign-in (signs out everywhere)
  freeze: (token: string) => send<void>('POST', '/v1/me/freeze', undefined, token),
};
