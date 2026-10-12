/**
 * Coupons, loyalty (stamp cards / memberships), "notify me" watches and venue
 * photos. Prototype: everything is stored on this phone.
 */
import * as Notifications from 'expo-notifications';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { usePersistentState } from '../hooks/usePersistentState';
import type { Accounts } from '../lib/accounts';
import { fetchVenuesByIds } from '../lib/api';
import type { Campaign } from '../lib/campaigns';
import { claimCoupon, couponCode, parseCoupons, redeemCoupon, type Coupon } from '../lib/coupons';
import {
  addStamp,
  customerCode,
  useReward as takeReward,
  type LoyaltyProgram,
  type Membership,
  type StampCard,
} from '../lib/loyalty';
import { addFeedback, type Feedback } from '../lib/feedback';
import { KEYS, loadJson } from '../lib/storage';
import { notificationText, parseWatches, toggleWatch, watchTriggered, type Watch } from '../lib/watch';
import { useSettings } from './SettingsContext';

const WATCH_CHECK_MS = 60_000;

const asArray = <T,>(raw: unknown): T[] => (Array.isArray(raw) ? (raw as T[]) : []);
const asRecord = <T,>(raw: unknown): Record<string, T> =>
  raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, T>) : {};

// Show phone notifications even while the app is open
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

type Engagement = {
  userKey: string;
  // Coupons
  coupons: Coupon[];
  views: Record<string, number>;
  claim: (campaign: Campaign) => string | null; // error message, e.g. limit reached
  redeem: (code: string, venueId: number) => string | null;
  recordView: (campaignId: string) => void;
  // Loyalty
  programs: LoyaltyProgram[];
  cards: StampCard[];
  memberships: Membership[];
  saveProgram: (program: LoyaltyProgram) => void;
  removeProgram: (venueId: number) => void;
  giveStamp: (code: string, venueId: number) => Promise<string>;
  redeemReward: (code: string, venueId: number) => Promise<string>;
  toggleMembership: (venueId: number) => void;
  // Watches
  watches: Watch[];
  toggleWatchFor: (venue: { id: number; name: string }) => void;
  alert: string | null;
  dismissAlert: () => void;
  // Photos
  photos: Record<string, string>;
  setPhoto: (venueId: number, uri: string) => void;
  // Feedback
  feedback: Feedback[];
  leaveFeedback: (item: Omit<Feedback, 'id' | 'userKey' | 'createdAt'>) => void;
  // Shows the in-app banner and, on phones, a local notification
  notify: (title: string, body: string, phone: boolean) => void;
};

const EngagementContext = createContext<Engagement | null>(null);

/** Find which account on this phone a customer code belongs to. */
async function userForCode(code: string): Promise<string | null> {
  const accounts = (await loadJson<Accounts>(KEYS.accounts)) ?? {};
  const wanted = code.trim().toUpperCase();
  return Object.keys(accounts).find((email) => customerCode(email) === wanted) ?? null;
}

export function EngagementProvider({ userKey, children }: { userKey: string; children: ReactNode }) {
  const { watchNotifications } = useSettings();
  const [coupons, setCoupons] = usePersistentState<Coupon[]>(KEYS.coupons, [], parseCoupons);
  const [views, setViews] = usePersistentState<Record<string, number>>(KEYS.campaignViews, {}, asRecord);
  const [programs, setPrograms] = usePersistentState<LoyaltyProgram[]>(KEYS.loyaltyPrograms, [], asArray);
  const [cards, setCards] = usePersistentState<StampCard[]>(KEYS.stampCards, [], asArray);
  const [memberships, setMemberships] = usePersistentState<Membership[]>(KEYS.memberships, [], asArray);
  const [watches, setWatches] = usePersistentState<Watch[]>(KEYS.watches, [], parseWatches);
  const [photos, setPhotos] = usePersistentState<Record<string, string>>(KEYS.photos, {}, asRecord);
  const [feedback, setFeedback] = usePersistentState<Feedback[]>(KEYS.feedback, [], asArray);
  const [alert, setAlert] = useState<string | null>(null);

  const notify = useCallback((title: string, body: string, phone: boolean) => {
    setAlert(`${title} · ${body}`);
    if (phone && Platform.OS !== 'web') {
      Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null }).catch(() => {});
    }
  }, []);

  const leaveFeedback = useCallback(
    (item: Omit<Feedback, 'id' | 'userKey' | 'createdAt'>) =>
      setFeedback((list) =>
        addFeedback(list, { ...item, id: `${userKey}:${item.venueId}`, userKey, createdAt: new Date().toISOString() }),
      ),
    [userKey, setFeedback],
  );
  // Count each campaign once per app session as "shown"
  const seen = useRef(new Set<string>());

  const claim = useCallback(
    (campaign: Campaign) => {
      const outcome = claimCoupon(coupons, campaign, userKey, new Date(), couponCode());
      if (outcome.error === null) setCoupons(() => outcome.coupons);
      return outcome.error;
    },
    [coupons, userKey, setCoupons],
  );

  const redeem = useCallback(
    (code: string, venueId: number) => {
      const outcome = redeemCoupon(coupons, code, venueId, new Date());
      if (outcome.error === null) setCoupons(() => outcome.coupons);
      return outcome.error;
    },
    [coupons, setCoupons],
  );

  const recordView = useCallback(
    (campaignId: string) => {
      if (seen.current.has(campaignId)) return;
      seen.current.add(campaignId);
      setViews((v) => ({ ...v, [campaignId]: (v[campaignId] ?? 0) + 1 }));
    },
    [setViews],
  );

  const saveProgram = useCallback(
    (program: LoyaltyProgram) => setPrograms((list) => [program, ...list.filter((p) => p.venueId !== program.venueId)]),
    [setPrograms],
  );
  const removeProgram = useCallback(
    (venueId: number) => setPrograms((list) => list.filter((p) => p.venueId !== venueId)),
    [setPrograms],
  );

  const giveStamp = useCallback(
    async (code: string, venueId: number) => {
      const program = programs.find((p) => p.venueId === venueId && p.kind === 'stamps');
      if (!program) return 'Önce bir damga kartı programı oluştur.';
      const customer = await userForCode(code);
      if (!customer) return 'Bu müşteri kodu bulunamadı.';
      const outcome = addStamp(cards, program, customer);
      setCards(() => outcome.cards);
      return outcome.card.stamps === 0
        ? `Kart doldu! Müşteri ödül kazandı: ${program.reward}.`
        : `Damga verildi (${outcome.card.stamps}/${program.stampsRequired}).`;
    },
    [programs, cards, setCards],
  );

  const redeemReward = useCallback(
    async (code: string, venueId: number) => {
      const customer = await userForCode(code);
      if (!customer) return 'Bu müşteri kodu bulunamadı.';
      const outcome = takeReward(cards, venueId, customer);
      if (outcome.error) return outcome.error;
      setCards(() => outcome.cards);
      return 'Ödül kullanıldı.';
    },
    [cards, setCards],
  );

  const toggleMembership = useCallback(
    (venueId: number) =>
      setMemberships((list) =>
        list.some((m) => m.venueId === venueId && m.userKey === userKey)
          ? list.filter((m) => !(m.venueId === venueId && m.userKey === userKey))
          : [...list, { venueId, userKey, since: new Date().toISOString() }],
      ),
    [userKey, setMemberships],
  );

  const toggleWatchFor = useCallback(
    (venue: { id: number; name: string }) => {
      setWatches((list) => toggleWatch(list, venue, new Date()));
      if (Platform.OS !== 'web' && watchNotifications) Notifications.requestPermissionsAsync().catch(() => {});
    },
    [setWatches, watchNotifications],
  );

  // While the app is open, check watched venues and notify once they drop below 70%
  useEffect(() => {
    if (watches.length === 0) return;
    const check = async () => {
      try {
        const venues = await fetchVenuesByIds(watches.map((w) => w.venueId));
        const emptied = venues.filter(watchTriggered);
        if (emptied.length === 0) return;
        setWatches((list) => list.filter((w) => !emptied.some((v) => v.id === w.venueId)));
        for (const venue of emptied) {
          const { title, body } = notificationText(venue);
          notify(title, body, watchNotifications);
        }
      } catch {
        // Try again on the next check
      }
    };
    check();
    const timer = setInterval(check, WATCH_CHECK_MS);
    return () => clearInterval(timer);
  }, [watches, setWatches, watchNotifications, notify]);

  const setPhoto = useCallback(
    (venueId: number, uri: string) => setPhotos((p) => ({ ...p, [venueId]: uri })),
    [setPhotos],
  );

  return (
    <EngagementContext.Provider
      value={{
        userKey,
        coupons,
        views,
        claim,
        redeem,
        recordView,
        programs,
        cards,
        memberships,
        saveProgram,
        removeProgram,
        giveStamp,
        redeemReward,
        toggleMembership,
        watches,
        toggleWatchFor,
        alert,
        dismissAlert: () => setAlert(null),
        photos,
        setPhoto,
        feedback,
        leaveFeedback,
        notify,
      }}
    >
      {children}
    </EngagementContext.Provider>
  );
}

export function useEngagement(): Engagement {
  const value = useContext(EngagementContext);
  if (!value) throw new Error('useEngagement must be used inside EngagementProvider');
  return value;
}
