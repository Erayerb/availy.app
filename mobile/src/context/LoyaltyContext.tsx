import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import type { LoyaltyProgram } from '../lib/loyalty';
import { loyaltyApi, type MyProgram, type ProgramInput } from '../lib/loyaltyApi';

// Stamps given at the counter show up within this time
const RELOAD_MS = 60_000;

type Loyalty = {
  programs: LoyaltyProgram[]; // active programs; `member` is set for the ones I joined
  join: (venueId: number) => Promise<string | null>;
  leave: (venueId: number) => Promise<void>;
  // Business: its own program
  mine: MyProgram | null;
  saveProgram: (input: ProgramInput) => Promise<string | null>;
  removeProgram: () => Promise<void>;
  giveStamp: (code: string) => Promise<string>;
  redeemReward: (code: string) => Promise<string>;
};

const LoyaltyContext = createContext<Loyalty | null>(null);

const asMessage = (e: unknown) => (e instanceof Error ? e.message : 'Bir sorun oldu, tekrar dene.');

/** v2: loyalty programs on the server; customers join the ones they want. */
export function LoyaltyProvider({ token, business, children }: { token: string | null; business: boolean; children: ReactNode }) {
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [mine, setMine] = useState<MyProgram | null>(null);

  const reload = useCallback(async () => {
    loyaltyApi.programs(token ?? undefined).then(setPrograms).catch(() => {});
    if (token && business) loyaltyApi.mine(token).then(setMine).catch(() => {});
  }, [token, business]);

  useEffect(() => {
    reload();
    const timer = setInterval(reload, RELOAD_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const join = useCallback(
    async (venueId: number) => {
      if (!token) return 'Sadakat programına katılmak için giriş yap.';
      try {
        await loyaltyApi.join(token, venueId);
        await reload();
        return null;
      } catch (e) {
        return asMessage(e);
      }
    },
    [token, reload],
  );

  const leave = useCallback(
    async (venueId: number) => {
      if (!token) return;
      await loyaltyApi.leave(token, venueId).catch(() => {});
      await reload();
    },
    [token, reload],
  );

  const saveProgram = useCallback(
    async (input: ProgramInput) => {
      if (!token) return 'Giriş yapmalısın.';
      try {
        setMine(await loyaltyApi.save(token, input));
        reload();
        return null;
      } catch (e) {
        return asMessage(e);
      }
    },
    [token, reload],
  );

  const removeProgram = useCallback(async () => {
    if (!token) return;
    await loyaltyApi.remove(token).catch(() => {});
    await reload();
  }, [token, reload]);

  const counter = useCallback(
    async (action: 'stamp' | 'reward', code: string) => {
      if (!token) return 'Giriş yapmalısın.';
      try {
        const { message } = await (action === 'stamp' ? loyaltyApi.stamp(token, code) : loyaltyApi.reward(token, code));
        reload();
        return message;
      } catch (e) {
        return asMessage(e);
      }
    },
    [token, reload],
  );
  const giveStamp = useCallback((code: string) => counter('stamp', code), [counter]);
  const redeemReward = useCallback((code: string) => counter('reward', code), [counter]);

  return (
    <LoyaltyContext.Provider value={{ programs, join, leave, mine, saveProgram, removeProgram, giveStamp, redeemReward }}>
      {children}
    </LoyaltyContext.Provider>
  );
}

export function useLoyalty(): Loyalty {
  const value = useContext(LoyaltyContext);
  if (!value) throw new Error('useLoyalty must be used inside LoyaltyProvider');
  return value;
}
