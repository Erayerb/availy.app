/** "Şu an burada": a photo taken at check-in, on the venue page for 24 hours. */
import { send } from './accountApi.ts';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export type Audience = 'everyone' | 'friends';
export type Moment = {
  id: number;
  created_at: string;
  expires_at: string;
  audience: Audience;
  level: 'low' | 'medium' | 'high' | null;
  username: string | null; // null: a private check-in ("Bir ziyaretçi")
  mine: boolean;
  points?: number;
};
export type ReportReason = 'inappropriate' | 'person' | 'unrelated' | 'spam';
export type ReportedMoment = {
  id: number;
  created_at: string;
  hidden_at: string | null;
  venue_id: number;
  venue_name: string;
  author: string | null;
  reports: number;
  reasons: ReportReason[];
};

export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: 'inappropriate', label: 'Uygunsuz içerik' },
  { id: 'person', label: 'İzinsiz kişi fotoğrafı' },
  { id: 'unrelated', label: 'Mekanla alakasız' },
  { id: 'spam', label: 'Spam / reklam' },
];

/** Hours and minutes left before it disappears: "23 sa", "40 dk". */
export function timeLeft(expiresAt: string, now: Date): string {
  const minutes = Math.max(0, Math.round((new Date(expiresAt).getTime() - now.getTime()) / 60_000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)} sa` : `${minutes} dk`;
}

export const momentsApi = {
  add: (token: string, checkinId: number, photo: string, audience: Audience) =>
    send<Moment>('POST', `/v1/checkins/${checkinId}/moment`, { photo, audience }, token),
  list: (venueId: number, token?: string | null) => send<Moment[]>('GET', `/v1/venues/${venueId}/moments`, undefined, token ?? undefined),
  remove: (token: string, id: number) => send<void>('DELETE', `/v1/moments/${id}`, undefined, token),
  report: (token: string, id: number, reason: ReportReason) => send<void>('POST', `/v1/moments/${id}/report`, { reason }, token),
  reported: (token: string) => send<ReportedMoment[]>('GET', '/v1/admin/moments', undefined, token),
  decide: (token: string, id: number, keep: boolean) => send<void>('POST', `/v1/admin/moments/${id}`, { keep }, token),
};

/** The image: friends-only photos need the sign-in, so the header goes with the request. */
export function momentImage(id: number, token?: string | null) {
  return { uri: `${API_URL}/v1/moments/${id}/image`, headers: token ? { Authorization: `Bearer ${token}` } : undefined };
}
