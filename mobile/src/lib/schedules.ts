/**
 * Scheduled / weekly recurring campaigns (Aylık Paket): e.g. every Tuesday 13:00 for 3 hours.
 * They live on the server, which starts the campaign when its time comes (the app need not be open).
 */
import { send } from './accountApi.ts';

export const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']; // 0 = Monday

export type ScheduledCampaign = {
  id: number;
  message: string;
  discount: number | null;
  radius_km: number;
  days: number[]; // 0 = Monday ... 6 = Sunday
  start_hour: number;
  duration_hours: number;
  active: boolean;
};

export type NewSchedule = Omit<ScheduledCampaign, 'id' | 'active'>;

export function validateSchedule(s: Pick<NewSchedule, 'message' | 'days' | 'start_hour'>): string | null {
  if (s.message.trim().length < 5) return 'Kampanya mesajını yaz.';
  if (s.days.length === 0) return 'En az bir gün seç.';
  if (!Number.isInteger(s.start_hour) || s.start_hour < 0 || s.start_hour > 23) return 'Başlangıç saati 0–23 olmalı.';
  return null;
}

/** The business's automations: ölü saat bildirimi, otomatik kampanya, zamanlanmış kampanyalar. */
export type Automation = { dead_hour_alerts: boolean; auto_campaign: boolean };

export const automationApi = {
  settings: (token: string) => send<Automation>('GET', '/v1/business/automation', undefined, token),
  saveSettings: (token: string, settings: Automation) => send<Automation>('PUT', '/v1/business/automation', settings, token),
  schedules: (token: string) => send<ScheduledCampaign[]>('GET', '/v1/business/schedules', undefined, token),
  addSchedule: (token: string, schedule: NewSchedule) => send<ScheduledCampaign>('POST', '/v1/business/schedules', schedule, token),
  setActive: (token: string, id: number, active: boolean) =>
    send<void>('PATCH', `/v1/business/schedules/${id}`, { active }, token),
  removeSchedule: (token: string, id: number) => send<void>('DELETE', `/v1/business/schedules/${id}`, undefined, token),
};
