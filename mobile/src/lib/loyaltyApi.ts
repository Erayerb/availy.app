/** v2: loyalty programs on the server, in the app's LoyaltyProgram shape. */
import { send } from './accountApi.ts';
import type { LoyaltyProgram } from './loyalty.ts';

type ServerProgram = {
  venue_id: number;
  venue_name: string;
  kind: 'stamps' | 'membership';
  stamps_required: number;
  reward: string;
  price: number;
  perk: string;
  active: boolean;
  member?: { stamps: number; rewards: number; total_stamps: number; joined_at: string } | null;
};

export type MyProgram = { program: LoyaltyProgram | null; members: number; stampsGiven: number };

export const toProgram = (p: ServerProgram): LoyaltyProgram => ({
  venueId: p.venue_id,
  venueName: p.venue_name,
  kind: p.kind,
  stampsRequired: p.stamps_required,
  reward: p.reward,
  price: p.price,
  perk: p.perk,
  active: p.active,
  member: p.member ? { stamps: p.member.stamps, rewards: p.member.rewards, totalStamps: p.member.total_stamps } : null,
});

type ServerMine = { program: ServerProgram | null; members: number; stamps_given: number };
const toMine = (m: ServerMine): MyProgram => ({
  program: m.program ? toProgram(m.program) : null,
  members: m.members,
  stampsGiven: m.stamps_given,
});

export type ProgramInput = Pick<LoyaltyProgram, 'kind' | 'stampsRequired' | 'reward' | 'price' | 'perk'> & { active: boolean };

export const loyaltyApi = {
  programs: async (token?: string) => (await send<ServerProgram[]>('GET', '/v1/loyalty', undefined, token)).map(toProgram),
  join: (token: string, venueId: number) => send<void>('POST', `/v1/loyalty/${venueId}/join`, undefined, token),
  leave: (token: string, venueId: number) => send<void>('DELETE', `/v1/loyalty/${venueId}/join`, undefined, token),
  mine: async (token: string) => toMine(await send<ServerMine>('GET', '/v1/me/loyalty', undefined, token)),
  save: async (token: string, p: ProgramInput) =>
    toMine(
      await send<ServerMine>(
        'PUT',
        '/v1/me/loyalty',
        { kind: p.kind, stamps_required: p.stampsRequired, reward: p.reward, price: p.price, perk: p.perk, active: p.active },
        token,
      ),
    ),
  remove: (token: string) => send<void>('DELETE', '/v1/me/loyalty', undefined, token),
  stamp: (token: string, code: string) => send<{ message: string }>('POST', '/v1/me/loyalty/stamp', { code }, token),
  reward: (token: string, code: string) => send<{ message: string }>('POST', '/v1/me/loyalty/reward', { code }, token),
};
