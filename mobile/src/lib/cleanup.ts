/**
 * Removes data that earlier versions kept on the phone and v2 no longer reads: campaigns, coupons and
 * view counts (now on the server), the old shared favorites list (now one list per account) and the
 * v1 venue feedback (now reviews on the server).
 */
import { KEYS, remove } from './storage.ts';

export const OLD_KEYS = ['availy.campaigns', 'availy.coupons', 'availy.campaignViews', 'availy.feedback', KEYS.favorites];

export async function removeOldData(): Promise<void> {
  for (const key of OLD_KEYS) await remove(key).catch(() => {});
}
