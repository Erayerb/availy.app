/**
 * Loyalty (stamp cards / memberships), "notify me" watches and venue photos,
 * stored on this phone (coupons are on the server: CampaignsContext).
 */
import * as Notifications from 'expo-notifications';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { usePersistentState } from '../hooks/usePersistentState';
import { fetchVenuesByIds } from '../lib/api';
import { canAddWatch, FREE_WATCH_LIMIT } from '../lib/premium';
import {
  addStamp,
  customerCode,
  useReward as takeReward,
  type LoyaltyProgram,
  type Membership,
  type StampCard,
} from '../lib/loyalty';
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
  // Shows the in-app banner and, on phones, a local notification
  notify: (title: string, body: string, phone: boolean) => void;
};

const EngagementContext = createContext<Engagement | null>(null);

/** Find which account used on this phone a customer code belongs to. */
async function userForCode(code: string): Promise<string | null> {
  const known = (await loadJson<string[]>(KEYS.knownCustomers)) ?? [];
  const wanted = code.trim().toUpperCase();
  return known.find((key) => customerCode(key) === wanted) ?? null;
}

export function EngagementProvider({ userKey, children }: { userKey: string; children: ReactNode }) {
  const { watchNotifications, premium } = useSettings();
  const [programs, setPrograms] = usePersistentState<LoyaltyProgram[]>(KEYS.loyaltyPrograms, [], asArray);
  const [cards, setCards] = usePersistentState<StampCard[]>(KEYS.stampCards, [], asArray);
  const [memberships, setMemberships] = usePersistentState<Membership[]>(KEYS.memberships, [], asArray);
  const [watches, setWatches] = usePersistentState<Watch[]>(KEYS.watches, [], parseWatches);
  const [photos, setPhotos] = usePersistentState<Record<string, string>>(KEYS.photos, {}, asRecord);
  const [alert, setAlert] = useState<string | null>(null);

  const notify = useCallback((title: string, body: string, phone: boolean) => {
    setAlert(`${title} · ${body}`);
    if (phone && Platform.OS !== 'web') {
      Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null }).catch(() => {});
    }
  }, []);

  // Loyalty programs, cards and memberships of venues that are no longer shown (v1 demo venues) are removed once
  useEffect(() => {
    const ids = [...new Set([...programs, ...cards, ...memberships].map((x) => x.venueId))];
    if (ids.length === 0) return;
    fetchVenuesByIds(ids)
      .then((found) => {
        const shown = new Set(found.map((v) => v.id));
        if (ids.every((id) => shown.has(id))) return;
        setPrograms((list) => list.filter((p) => shown.has(p.venueId)));
        setCards((list) => list.filter((c) => shown.has(c.venueId)));
        setMemberships((list) => list.filter((m) => shown.has(m.venueId)));
      })
      .catch(() => {}); // try again next time
  }, [programs.length, cards.length, memberships.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const adding = !watches.some((w) => w.venueId === venue.id);
      if (adding && !canAddWatch(watches.length, premium)) {
        setAlert(`Ücretsiz planda aynı anda ${FREE_WATCH_LIMIT} mekanı takip edebilirsin. Sınırsız takip için Premium: Daha fazla → Abonelik`);
        return;
      }
      setWatches((list) => toggleWatch(list, venue, new Date()));
      if (Platform.OS !== 'web' && watchNotifications) Notifications.requestPermissionsAsync().catch(() => {});
    },
    [setWatches, watchNotifications, watches, premium],
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
