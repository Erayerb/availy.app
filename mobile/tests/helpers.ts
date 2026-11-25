/** Test helpers: a campaign object as the server would send it, and the same campaign ended. */
import type { Campaign, NewCampaign } from '../src/lib/campaigns.ts';

export function createCampaign(input: NewCampaign, now: Date, id: string): Campaign {
  return {
    ...input,
    message: input.message.trim(),
    id,
    startsAt: now.toISOString(),
    endsAt: new Date(now.getTime() + input.durationHours * 3_600_000).toISOString(),
  };
}

export function endCampaign(c: Campaign, now: Date): Campaign {
  return { ...c, endsAt: now.toISOString() };
}
