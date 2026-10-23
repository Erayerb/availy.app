import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { campaignApi } from '../lib/campaignApi';
import { activeCampaignForVenue, type Campaign, type NewCampaign } from '../lib/campaigns';
import type { Coupon } from '../lib/coupons';
import { dueSchedules, type ScheduledCampaign } from '../lib/schedules';
import { KEYS, loadJson, saveJson } from '../lib/storage';

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
  activeFor: (venueId: number) => Campaign | null;
  schedules: ScheduledCampaign[];
  saveSchedule: (schedule: ScheduledCampaign) => void;
  removeSchedule: (id: string) => void;
};

const CampaignsContext = createContext<Campaigns | null>(null);

const asMessage = (e: unknown) => (e instanceof Error ? e.message : 'Bir sorun oldu, tekrar dene.');

/** v2: campaigns and coupons on the server; scheduled campaigns are kept on the business's phone. */
export function CampaignsProvider({ token, business, children }: { token: string | null; business: boolean; children: ReactNode }) {
  const [running, setRunning] = useState<Campaign[]>([]);
  const [mine, setMine] = useState<Campaign[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [schedules, setSchedules] = useState<ScheduledCampaign[]>([]);
  const [fired, setFired] = useState<string[] | null>(null);

  const reload = useCallback(async () => {
    campaignApi.running().then(setRunning).catch(() => {});
    if (!token) return setCoupons([]);
    campaignApi.coupons(token).then(setCoupons).catch(() => {});
    if (business) campaignApi.mine(token).then(setMine).catch(() => {});
  }, [token, business]);

  useEffect(() => {
    reload();
    const timer = setInterval(reload, RELOAD_MS);
    return () => clearInterval(timer);
  }, [reload]);

  useEffect(() => {
    loadJson<ScheduledCampaign[]>(KEYS.schedules).then((raw) => setSchedules(Array.isArray(raw) ? raw : []));
    loadJson<string[]>(KEYS.firedSchedules).then((raw) => setFired(Array.isArray(raw) ? raw : []));
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

  // Turn due scheduled campaigns into real ones (checked every tick while the app is open)
  useEffect(() => {
    if (fired === null || !business) return;
    const due = dueSchedules(schedules, new Set(fired), now);
    if (due.length === 0) return;
    // Marked first, so a slow request does not send the same one twice
    const next = [...fired, ...due.map((d) => d.key)].slice(-500);
    setFired(next);
    saveJson(KEYS.firedSchedules, next);
    due.forEach(({ campaign }) => create(campaign));
  }, [schedules, fired, now, business, create]);

  const saveSchedule = useCallback((schedule: ScheduledCampaign) => {
    setSchedules((current) => {
      const next = [schedule, ...current.filter((s) => s.id !== schedule.id)];
      saveJson(KEYS.schedules, next);
      return next;
    });
    setNow(new Date());
  }, []);

  const removeSchedule = useCallback((id: string) => {
    setSchedules((current) => {
      const next = current.filter((s) => s.id !== id);
      saveJson(KEYS.schedules, next);
      return next;
    });
  }, []);

  // The business's own list has its ended campaigns too; the rest are only the running ones
  const campaigns = useMemo(() => [...mine, ...running.filter((r) => !mine.some((m) => m.id === r.id))], [mine, running]);
  const activeFor = useCallback(
    (venueId: number) => activeCampaignForVenue(campaigns, venueId, now),
    [campaigns, now],
  );

  return (
    <CampaignsContext.Provider
      value={{ campaigns, coupons, now, create, end, remove, claim, redeem, recordView, activeFor, schedules, saveSchedule, removeSchedule }}
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
