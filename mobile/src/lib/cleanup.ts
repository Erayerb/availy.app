/**
 * Removes data that earlier versions kept on the phone and v2 no longer reads: campaigns, coupons and
 * view counts, loyalty programs, stamp cards and memberships (now on the server), the accounts used on
 * this phone (for loyalty codes), the old shared favorites list (now one list per account) and the
 * v1 venue feedback (now reviews on the server).
 */
import { KEYS, remove } from './storage.ts';

export const OLD_KEYS = [
  'availy.campaigns',
  'availy.coupons',
  'availy.campaignViews',
  'availy.feedback',
  'availy.loyaltyPrograms',
  'availy.stampCards',
  'availy.memberships',
  'availy.knownCustomers',
  'availy.support', // bug reports were kept on the phone before they went to the server
  KEYS.favorites,
];

export async function removeOldData(): Promise<void> {
  for (const key of OLD_KEYS) await remove(key).catch(() => {});
}
