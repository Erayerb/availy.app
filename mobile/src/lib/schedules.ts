/**
 * Scheduled / weekly recurring campaigns (Aylık paket): e.g. every Tuesday 13:00 for 3 hours.
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

// Day names a message may use ("salı", "salıları", "cumartesi"): the longer one first (cumartesi before cuma)
const DAY_WORDS: [string, number][] = [
  ['pazartesi', 0], ['salı', 1], ['çarşamba', 2], ['perşembe', 3], ['cumartesi', 5], ['cuma', 4], ['pazar', 6],
];
const DAY_LABELS = ['pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi', 'pazar'];

/** The days the message names ("Her salı…" → [1]). */
export function daysInMessage(message: string): number[] {
  const found = new Set<number>();
  for (const word of message.toLocaleLowerCase('tr-TR').split(/[^a-zçğıöşü]+/)) {
    const day = DAY_WORDS.find(([name]) => word.startsWith(name));
    if (day) found.add(day[1]);
  }
  return [...found].sort((a, b) => a - b);
}

export function validateSchedule(s: Pick<NewSchedule, 'message' | 'days' | 'start_hour'>): string | null {
  if (s.message.trim().length < 5) return 'Kampanya mesajını yaz.';
  if (s.days.length === 0) return 'En az bir gün seç.';
  if (!Number.isInteger(s.start_hour) || s.start_hour < 0 || s.start_hour > 23) return 'Başlangıç saati 0–23 olmalı.';
  // "Her salı" in the message, but Salı is not chosen (or another day is chosen that the message does not say)
  const named = daysInMessage(s.message);
  const missing = named.filter((d) => !s.days.includes(d));
  if (missing.length > 0) return `Mesajda "${DAY_LABELS[missing[0]]}" yazıyor ama o gün seçili değil. Günleri ya da mesajı düzelt.`;
  const unsaid = named.length > 0 ? s.days.filter((d) => !named.includes(d)) : [];
  if (unsaid.length > 0) return `${DAY_LABELS[unsaid[0]][0].toLocaleUpperCase('tr-TR')}${DAY_LABELS[unsaid[0]].slice(1)} seçili ama mesajda yazmıyor. Günleri ya da mesajı düzelt.`;
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
