/** v2 "Bilgi yanlış mı?" on the venue page, and the admin's "Kontrol edilecek mekanlar" (3 people, same thing). */
import { send } from './accountApi';

export type IssueKind = 'closed' | 'hours' | 'location' | 'name';

export const ISSUE_KINDS: { kind: IssueKind; label: string }[] = [
  { kind: 'closed', label: 'Kapanmış' },
  { kind: 'hours', label: 'Saatler yanlış' },
  { kind: 'location', label: 'Konum yanlış' },
  { kind: 'name', label: 'Adı yanlış' },
];

export const issueLabel = (kind: IssueKind) => ISSUE_KINDS.find((k) => k.kind === kind)?.label ?? kind;

export type VenueIssue = {
  venue_id: number;
  venue_name: string;
  district: string;
  open_hour: number | null;
  close_hour: number | null;
  kind: IssueKind;
  reports: number;
  notes: string[];
  last_at: string;
};

export type Resolution = { action: 'close' | 'fixed' | 'dismiss'; name?: string; open_hour?: number; close_hour?: number };

export const venueIssuesApi = {
  report: (token: string, venueId: number, kind: IssueKind, note: string) =>
    send<void>('POST', `/v1/venues/${venueId}/issues`, { kind, note: note.trim() || null }, token),
  open: (token: string) => send<VenueIssue[]>('GET', '/v1/admin/venue-issues', undefined, token),
  resolve: (token: string, venueId: number, kind: IssueKind, resolution: Resolution) =>
    send<void>('POST', `/v1/admin/venue-issues/${venueId}/${kind}`, resolution, token),
};
