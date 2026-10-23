/**
 * What to do when a business's own venue hits a dead hour (checked while the app is open).
 * v2: a dead hour is when customers' fresh check-ins say the open venue is Sakin.
 */
import { liveLevel, type Crowd } from './crowd.ts';

export const ALERT_EVERY_MS = 2 * 3_600_000; // remind at most every 2 hours
export const AUTO_CAMPAIGN_EVERY_MS = 3 * 3_600_000;

export type MonitorState = { lastAlertAt?: string; lastAutoAt?: string };

export function decideBusinessActions(
  venue: { open_now: boolean; crowd?: Crowd },
  state: MonitorState,
  options: { deadHourAlerts: boolean; autoCampaign: boolean; hasActiveCampaign: boolean },
  now: Date,
): { alert: boolean; autoCampaign: boolean } {
  const dead = liveLevel(venue) === 'low';
  const since = (iso?: string) => (iso ? now.getTime() - new Date(iso).getTime() : Infinity);
  return {
    alert: dead && options.deadHourAlerts && since(state.lastAlertAt) >= ALERT_EVERY_MS,
    autoCampaign:
      dead && options.autoCampaign && !options.hasActiveCampaign && since(state.lastAutoAt) >= AUTO_CAMPAIGN_EVERY_MS,
  };
}
