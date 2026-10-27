import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { campaignApi } from '../lib/campaignApi';
import { activeCampaignForVenue, type Campaign, type NewCampaign } from '../lib/campaigns';
import type { Coupon } from '../lib/coupons';
import { automationApi, type NewSchedule, type ScheduledCampaign } from '../lib/schedules';

// Re-check "active" / "time left" this often
const TICK_MS = 30_000;
// New campaigns of other venues show up within this time
const RELOAD_MS = 60_000;

type Campaigns = {
  campaigns: Campaign[]; // running ones, plus the business's own (also ended)
  coupons: Coupon[]; // mine; for a business, the coupons taken for its campaigns
  now: Date;
  // Each resolves to an error message, or null on success
  create: (input: NewCampaign) => Promise<string | null>;
  end: (id: string) => Promise<void>;
  remove: (ids: string[]) => Promise<void>;
  claim: (campaign: Campaign) => Promise<string | null>;
  redeem: (code: string) => Promise<string | null>;
  recordView: (campaignId: string) => void;
  reload: () => Promise<void>; // e.g. after a check-in that gave a coupon
  activeFor: (venueId: number) => Campaign | null;
  // Business: weekly scheduled campaigns, run by the server
  schedules: ScheduledCampaign[];
  addSchedule: (schedule: NewSchedule) => Promise<string | null>;
  setScheduleActive: (id: number, active: boolean) => void;
  removeSchedule: (id: number) => void;
};

const CampaignsContext = createContext<Campaigns | null>(null);

const asMessage = (e: unknown) => (e instanceof Error ? e.message : 'Bir sorun oldu, tekrar dene.');

/** v2: campaigns, coupons and the business's scheduled campaigns, all on the server. */
export function CampaignsProvider({ token, business, children }: { token: string | null; business: boolean; children: ReactNode }) {
  const [running, setRunning] = useState<Campaign[]>([]);
  const [mine, setMine] = useState<Campaign[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [schedules, setSchedules] = useState<ScheduledCampaign[]>([]);

  const reload = useCallback(async () => {
    campaignApi.running().then(setRunning).catch(() => {});
    if (!token) return setCoupons([]);
    campaignApi.coupons(token).then(setCoupons).catch(() => {});
    if (business) {
      campaignApi.mine(token).then(setMine).catch(() => {});
      automationApi.schedules(token).then(setSchedules).catch(() => {});
    }
  }, [token, business]);

  useEffect(() => {
    reload();
    const timer = setInterval(reload, RELOAD_MS);
    return () => clearInterval(timer);
  }, [reload]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const create = useCallback(
    async (input: NewCampaign) => {
      if (!token) return 'Kampanya göndermek için giriş yap.';
      try {
        await campaignApi.create(token, input);
        setNow(new Date());
        await reload();
        return null;
      } catch (e) {
        return asMessage(e);
      }
    },
    [token, reload],
  );

  const end = useCallback(
    async (id: string) => {
      if (!token) return;
      await campaignApi.end(token, id).catch(() => {});
      setNow(new Date());
      await reload();
    },
    [token, reload],
  );

  // Removes ended campaigns from the business's list; customers keep their coupons
  const remove = useCallback(
    async (ids: string[]) => {
      if (!token) return;
      await campaignApi.hide(token, ids).catch(() => {});
      setMine((list) => list.filter((c) => !ids.includes(c.id)));
    },
    [token],
  );

  const claim = useCallback(
    async (campaign: Campaign) => {
      if (!token) return 'Kupon almak için giriş yap ya da misafir olarak devam et.';
      try {
        const coupon = await campaignApi.claim(token, campaign.id);
        setCoupons((list) => [coupon, ...list.filter((c) => c.code !== coupon.code)]);
        reload();
        return null;
      } catch (e) {
        return asMessage(e);
      }
    },
    [token, reload],
  );

  const redeem = useCallback(
    async (code: string) => {
      if (!token) return 'Giriş yapmalısın.';
      try {
        const used = await campaignApi.redeem(token, code);
        setCoupons((list) => list.map((c) => (c.code === used.code ? used : c)));
        reload();
        return null;
      } catch (e) {
        return asMessage(e);
      }
    },
    [token, reload],
  );

  // Counted once per person on the server; asked once per app session here
  const viewed = useRef(new Set<string>());
  const recordView = useCallback(
    (campaignId: string) => {
      if (!token || business || viewed.current.has(campaignId)) return;
      viewed.current.add(campaignId);
      campaignApi.view(token, campaignId).catch(() => viewed.current.delete(campaignId));
    },
    [token, business],
  );

  const addSchedule = useCallback(
    async (schedule: NewSchedule) => {
      if (!token) return 'Giriş yapmalısın.';
      try {
        const saved = await automationApi.addSchedule(token, schedule);
        setSchedules((list) => [...list, saved]);
        return null;
      } catch (e) {
        return asMessage(e);
      }
    },
    [token],
  );

  const setScheduleActive = useCallback(
    (id: number, active: boolean) => {
      if (!token) return;
      setSchedules((list) => list.map((s) => (s.id === id ? { ...s, active } : s)));
      automationApi.setActive(token, id, active).catch(reload);
    },
    [token, reload],
  );

  const removeSchedule = useCallback(
    (id: number) => {
      if (!token) return;
      setSchedules((list) => list.filter((s) => s.id !== id));
      automationApi.removeSchedule(token, id).catch(reload);
    },
    [token, reload],
  );

  // The business's own list has its ended campaigns too; the rest are only the running ones
  const campaigns = useMemo(() => [...mine, ...running.filter((r) => !mine.some((m) => m.id === r.id))], [mine, running]);
  const activeFor = useCallback(
    (venueId: number) => activeCampaignForVenue(campaigns, venueId, now),
    [campaigns, now],
  );

  return (
    <CampaignsContext.Provider
      value={{ campaigns, coupons, now, create, end, remove, claim, redeem, recordView, reload, activeFor, schedules, addSchedule, setScheduleActive, removeSchedule }}
    >
      {children}
    </CampaignsContext.Provider>
  );
}

export function useCampaigns(): Campaigns {
  const value = useContext(CampaignsContext);
  if (!value) throw new Error('useCampaigns must be used inside CampaignsProvider');
  return value;
}
