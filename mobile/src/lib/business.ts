/** v2 business panel: statistics from customers' check-ins. */
import { scheduleSuggestion } from './campaigns.ts';
import { send } from './accountApi.ts';
import type { Level } from './occupancy.ts';

export type HourStat = { hour: number; checkins: number; level: Level | null };
export type QuietSlot = { weekday: number; start_hour: number; hours: number; checkins: number };

export type VenueStats = {
  today: HourStat[];
  today_checkins: number;
  week_checkins: number;
  week_people: number;
  week_returning: number;
  weekday: number[]; // last 30 days, Monday first
  quiet_slot?: QuietSlot | null; // the emptiest two hours of the week (needs a month with enough check-ins)
  total_checkins: number;
  // username is null for a private check-in; reward is what the business already sent
  discovered_by: { username: string | null; at: string; can_reward: boolean; reward: string | null } | null;
  // Müşteriler (anonymous): different people and regulars (3+ check-ins) in 30 days, the top visit counts
  month_people: number;
  regulars: number;
  top_visits: number[];
  month_checkins?: number; // this month so far
  last_month_checkins?: number; // the same days of last month
  month_change_pct?: number | null; // +20 = 20% more than last month
};

export const WEEKDAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

/** What the business's plan and venue give it (GET /v1/business/plan). */
export type BusinessAccess = {
  plan: 'saas' | 'pay_per_use'; // pay_per_use: the free plan (old name)
  founder: boolean;
  verified: boolean;
  stats: boolean;
  free_campaigns_per_month: number;
  free_campaigns_left: number; // this month (verified venues)
  next_campaign: 'saas' | 'founder' | 'free' | 'unverified' | 'blocked';
  trial_until?: string | null; // the 15-day trial, running
  trial_available?: boolean;
  founder_until?: string | null; // kurucu mekan: the free Aylık paket ends then
};

/** Under the campaign form: how this campaign is covered. */
export function campaignCostText(access: BusinessAccess | null): string {
  if (!access) return '';
  if (access.next_campaign === 'saas') return 'Aylık paketine dahil (sınırsız).';
  if (access.next_campaign === 'founder') return 'Kurucu mekan: sınırsız ve ücretsiz.';
  if (access.next_campaign === 'free') return `Ücretsiz · bu ay ${access.free_campaigns_left} kampanya hakkın kaldı.`;
  if (access.next_campaign === 'unverified')
    return `Mekanını doğrula (ücretsiz): ayda ${access.free_campaigns_per_month} kampanya hakkın olur. Sınırsız kampanya Aylık pakette.`;
  return `Bu ayki ${access.free_campaigns_per_month} ücretsiz kampanyanı kullandın. Sınırsız kampanya Aylık pakette.`;
}

export type StandingReward = { id: number; points: number; discount: number; active: boolean };
export type VenueReward = { campaign_id: number; points: number; discount: number; next_at: string | null };
export type MonthReport = { month: string; checkins: number; people: number; new_people: number; coupons_used: number; campaigns: number };
export type SalesPitch = {
  week_checkins: number;
  week_people: number;
  busiest_hour: number | null;
  favorites: number;
  month_checkins: number;
  reviews: number;
  rating: number | null;
  joined: boolean;
  nearby_joined: number;
};

export const businessApi = {
  // Kalıcı ödül ("200 puan = %10"): the business's own, and a venue's for customers
  reward: (token: string) => send<StandingReward | null>('GET', '/v1/business/reward', undefined, token),
  saveReward: (token: string, points: number, discount: number, active: boolean) =>
    send<StandingReward>('PUT', '/v1/business/reward', { points, discount, active }, token),
  venueReward: (venueId: number, token: string | null) => send<VenueReward | null>('GET', `/v1/venues/${venueId}/reward`, undefined, token ?? undefined),
  // "availo bu ay size X müşteri getirdi"
  report: (token: string, monthsBack = 0) => send<MonthReport>('GET', `/v1/business/report?months_back=${monthsBack}`, undefined, token),
  // Every plan: today's check-ins and new customers
  today: (token: string) => send<{ checkins: number; people: number; new_people: number }>('GET', '/v1/business/today', undefined, token),
  trial: (token: string) => send<BusinessAccess>('POST', '/v1/business/trial', undefined, token),
  // Yönetici: numbers for a venue that has not joined
  pitch: (token: string, venueId: number) => send<SalesPitch>('GET', `/v1/admin/venues/${venueId}/pitch`, undefined, token),
  access: (token: string) => send<BusinessAccess>('GET', '/v1/business/plan', undefined, token),
  stats: (token: string, venueId: number) => send<VenueStats>('GET', `/v1/venues/${venueId}/stats`, undefined, token),
};

/** "En çok check-in 14:00'te" — the busiest hour today, or null without check-ins. */
export function busiestHour(today: HourStat[]): number | null {
  const best = today.reduce<HourStat | null>((a, h) => (h.checkins > (a?.checkins ?? 0) ? h : a), null);
  return best ? best.hour : null;
}

/** The one weekday with the fewest check-ins; null when several days share the lowest count. */
export function quietestWeekday(weekday: number[]): number | null {
  const min = Math.min(...weekday);
  return weekday.filter((n) => n === min).length === 1 ? weekday.indexOf(min) : null;
}

export type ProfileStep = { key: 'photo' | 'address' | 'instagram' | 'phone' | 'amenities'; label: string; done: boolean };

/** "Profilin %60 dolu": what a venue page needs to look complete (İşletme profili). */
export function profileSteps(
  venue: { photo_at?: string | null; address?: string; instagram?: string | null; phone?: string | null; amenity_keys?: string[] | null },
): ProfileStep[] {
  return [
    { key: 'photo', label: 'Kapak fotoğrafı', done: !!venue.photo_at },
    { key: 'address', label: 'Adres', done: !!venue.address?.trim() },
    { key: 'instagram', label: 'Instagram', done: !!venue.instagram?.trim() },
    { key: 'phone', label: 'Telefon', done: !!venue.phone?.trim() },
    { key: 'amenities', label: 'Özellikler', done: !!venue.amenity_keys?.length },
  ];
}

const DAY_NAMES = ['pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi', 'pazar'];

/** "Salı 14:00–16:00". */
export function quietSlotLabel(slot: QuietSlot): string {
  const name = DAY_NAMES[slot.weekday];
  const hour = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
  return `${name[0].toLocaleUpperCase('tr-TR')}${name.slice(1)} ${hour(slot.start_hour)}–${hour(slot.start_hour + slot.hours)}`;
}

/** The ready-made weekly campaign for that time: %20, 2 km. */
export const quietSlotSchedule = (slot: QuietSlot, category: string) => ({
  message: scheduleSuggestion(category, [slot.weekday], slot.start_hour, slot.hours, 20),
  discount: 20,
  radius_km: 2,
  days: [slot.weekday],
  start_hour: slot.start_hour,
  duration_hours: slot.hours,
});

/** "Geçen aya göre +%20" / "−%10" / "aynı"; null when last month had nothing to compare with. */
export function monthChangeText(pct: number | null | undefined): string | null {
  if (pct === null || pct === undefined) return null;
  if (pct === 0) return 'geçen ayla aynı';
  return `geçen aya göre ${pct > 0 ? '+' : '−'}%${Math.abs(pct)}`;
}
