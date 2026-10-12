/**
 * Scheduled / weekly recurring campaigns (SaaS plan): e.g. every Tuesday
 * 13:00 for 3 hours. While the app is open, due occurrences become campaigns.
 */
import type { NewCampaign } from './campaigns.ts';

export type ScheduledCampaign = {
  id: string;
  venueId: number;
  venueName: string;
  lat: number;
  lon: number;
  message: string;
  discount: number | null;
  radiusKm: number;
  days: number[]; // 0 = Monday ... 6 = Sunday
  startHour: number;
  durationHours: number;
  active: boolean;
};

const ISTANBUL_OFFSET_MS = 3 * 3_600_000;

/** Istanbul weekday (Monday 0), hour and date of a moment. */
export function istanbulTime(now: Date) {
  const local = new Date(now.getTime() + ISTANBUL_OFFSET_MS);
  return { weekday: (local.getUTCDay() + 6) % 7, hour: local.getUTCHours(), date: local.toISOString().slice(0, 10) };
}

export function validateSchedule(s: Pick<ScheduledCampaign, 'message' | 'days' | 'startHour' | 'durationHours'>): string | null {
  if (s.message.trim().length < 5) return 'Kampanya mesajını yaz.';
  if (s.days.length === 0) return 'En az bir gün seç.';
  if (!Number.isInteger(s.startHour) || s.startHour < 0 || s.startHour > 23) return 'Başlangıç saati 0–23 olmalı.';
  return null;
}

/** Occurrence key so the same schedule fires once per day. */
export const occurrenceKey = (scheduleId: string, date: string) => `${scheduleId}@${date}`;

/** Schedules that should be running now and have not created a campaign today. */
export function dueSchedules(
  schedules: ScheduledCampaign[],
  firedKeys: Set<string>,
  now: Date,
): { schedule: ScheduledCampaign; key: string; campaign: NewCampaign }[] {
  const { weekday, hour, date } = istanbulTime(now);
  return schedules
    .filter((s) => s.active && s.days.includes(weekday) && hour >= s.startHour && hour < s.startHour + s.durationHours)
    .map((s) => ({ schedule: s, key: occurrenceKey(s.id, date) }))
    .filter(({ key }) => !firedKeys.has(key))
    .map(({ schedule: s, key }) => ({
      schedule: s,
      key,
      campaign: {
        venueId: s.venueId,
        venueName: s.venueName,
        lat: s.lat,
        lon: s.lon,
        message: s.message,
        discount: s.discount,
        radiusKm: s.radiusKm,
        // Only the part of the window that is left
        durationHours: s.startHour + s.durationHours - hour,
      },
    }));
}
