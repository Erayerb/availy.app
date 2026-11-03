/** v2 Çalışan hesapları: the business invites with a code; staff work only the counter of that venue. */
import { send } from './accountApi';

export type StaffMember = { id: number; username: string | null; joined_at: string; coupons: number; stamps: number; rewards: number };
export type Workplace = { venue_id: number; venue_name: string; joined_at: string; has_stamps: boolean | null };

export const staffApi = {
  invite: (token: string) => send<{ code: string; expires_at: string }>('POST', '/v1/staff/invite', undefined, token),
  list: (token: string) => send<StaffMember[]>('GET', '/v1/staff', undefined, token),
  remove: (token: string, id: number) => send<void>('DELETE', `/v1/staff/${id}`, undefined, token),
  join: (token: string, code: string) => send<Workplace>('POST', '/v1/staff/join', { code }, token),
  workplace: (token: string) => send<Workplace | null>('GET', '/v1/staff/me', undefined, token),
  leave: (token: string) => send<void>('DELETE', '/v1/staff/me', undefined, token),
};

export const staffInviteMessage = (venueName: string, code: string) =>
  `${venueName} kasası için availy çalışan kodun: ${code}\n\nUygulamada kendi hesabınla giriş yap, Daha fazla > Çalışan girişi'ne bu kodu yaz. Kod 7 gün geçerli ve tek kullanımlık.`;
