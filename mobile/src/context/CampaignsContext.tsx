import * as Crypto from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import {
  activeCampaignForVenue,
  createCampaign,
  endCampaign,
  parseCampaigns,
  type Campaign,
  type NewCampaign,
} from '../lib/campaigns';
import { dueSchedules, type ScheduledCampaign } from '../lib/schedules';
import { KEYS, loadJson, saveJson } from '../lib/storage';

// Re-check "active" / "time left" this often
const TICK_MS = 30_000;

type Campaigns = {
  campaigns: Campaign[];
  now: Date;
  create: (input: NewCampaign) => Campaign;
  end: (id: string) => void;
  activeFor: (venueId: number) => Campaign | null;
  schedules: ScheduledCampaign[];
  saveSchedule: (schedule: ScheduledCampaign) => void;
  removeSchedule: (id: string) => void;
};

const CampaignsContext = createContext<Campaigns | null>(null);

/** Campaigns created by business accounts on this phone (prototype, no server). */
export function CampaignsProvider({ children }: { children: ReactNode }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [schedules, setSchedules] = useState<ScheduledCampaign[]>([]);
  const [fired, setFired] = useState<string[]>([]);

  useEffect(() => {
    loadJson<unknown>(KEYS.campaigns).then((raw) => setCampaigns(parseCampaigns(raw)));
    loadJson<ScheduledCampaign[]>(KEYS.schedules).then((raw) => setSchedules(Array.isArray(raw) ? raw : []));
    loadJson<string[]>(KEYS.firedSchedules).then((raw) => setFired(Array.isArray(raw) ? raw : []));
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const update = useCallback((change: (current: Campaign[]) => Campaign[]) => {
    setCampaigns((current) => {
      const next = change(current);
      saveJson(KEYS.campaigns, next);
      return next;
    });
  }, []);

  const create = useCallback(
    (input: NewCampaign) => {
      const campaign = createCampaign(input, new Date(), Crypto.randomUUID());
      update((current) => [campaign, ...current]);
      setNow(new Date());
      return campaign;
    },
    [update],
  );

  const end = useCallback(
    (id: string) => {
      const at = new Date();
      update((current) => current.map((c) => (c.id === id ? endCampaign(c, at) : c)));
      setNow(at);
    },
    [update],
  );

  // Turn due scheduled campaigns into real ones (checked every tick while the app is open)
  useEffect(() => {
    const due = dueSchedules(schedules, new Set(fired), now);
    if (due.length === 0) return;
    const created = due.map(({ campaign }) => createCampaign(campaign, now, Crypto.randomUUID()));
    update((current) => [...created, ...current]);
    setFired((current) => {
      const next = [...current, ...due.map((d) => d.key)].slice(-500);
      saveJson(KEYS.firedSchedules, next);
      return next;
    });
  }, [schedules, fired, now, update]);

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

  const activeFor = useCallback(
    (venueId: number) => activeCampaignForVenue(campaigns, venueId, now),
    [campaigns, now],
  );

  return (
    <CampaignsContext.Provider value={{ campaigns, now, create, end, activeFor, schedules, saveSchedule, removeSchedule }}>
      {children}
    </CampaignsContext.Provider>
  );
}

export function useCampaigns(): Campaigns {
  const value = useContext(CampaignsContext);
  if (!value) throw new Error('useCampaigns must be used inside CampaignsProvider');
  return value;
}
