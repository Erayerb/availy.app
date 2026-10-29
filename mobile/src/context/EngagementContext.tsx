/**
 * "Notify me" watches (on the server for registered users, with a copy on the phone), older venue
 * photos stored on this phone, and the in-app alert banner.
 * (Coupons: CampaignsContext, loyalty: LoyaltyContext, both on the server.)
 */
import * as Notifications from 'expo-notifications';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { usePersistentState } from '../hooks/usePersistentState';
import { fetchVenuesByIds } from '../lib/api';
import { canAddWatch, FREE_WATCH_LIMIT } from '../lib/premium';
import { KEYS, loadJson, saveJson } from '../lib/storage';
import { userSyncApi } from '../lib/userSync';
import { notificationText, parseWatches, toggleWatch, watchExpired, watchTriggered, type Watch } from '../lib/watch';
import { useSettings } from './SettingsContext';

const WATCH_CHECK_MS = 60_000;

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

export function EngagementProvider({ userKey, token, children }: { userKey: string; token: string | null; children: ReactNode }) {
  const { watchNotifications, premium } = useSettings();
  const [watches, setWatches] = usePersistentState<Watch[]>(KEYS.watches, [], parseWatches);
  const [photos, setPhotos] = usePersistentState<Record<string, string>>(KEYS.photos, {}, asRecord);
  const [alert, setAlert] = useState<string | null>(null);

  // Registered: the server's bells; the phone's older ones go up once
  useEffect(() => {
    if (!token) return;
    let stale = false;
    (async () => {
      try {
        const uploadedKey = `${KEYS.watches}.uploaded.${userKey}`;
        if (!(await loadJson<boolean>(uploadedKey))) {
          const local = parseWatches(await loadJson<unknown>(KEYS.watches));
          await Promise.all(local.map((w) => userSyncApi.addWatch(token, w.venueId, w.createdAt).catch(() => {})));
          await saveJson(uploadedKey, true);
        }
        const server = await userSyncApi.watches(token);
        if (!stale) setWatches(() => server.map((w) => ({ venueId: w.venue_id, venueName: w.venue_name, createdAt: w.created_at })));
      } catch {
        // Offline: the phone's copy for now
      }
    })();
    return () => {
      stale = true;
    };
  }, [token, userKey, setWatches]);

  const notify = useCallback((title: string, body: string, phone: boolean) => {
    setAlert(`${title} · ${body}`);
    if (phone && Platform.OS !== 'web') {
      Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null }).catch(() => {});
    }
  }, []);

  const toggleWatchFor = useCallback(
    (venue: { id: number; name: string }) => {
      const adding = !watches.some((w) => w.venueId === venue.id);
      if (adding && !canAddWatch(watches.length, premium)) {
        setAlert(`Ücretsiz planda aynı anda ${FREE_WATCH_LIMIT} mekanı takip edebilirsin. Sınırsız takip için Premium: Daha fazla → Abonelik`);
        return;
      }
      setWatches((list) => toggleWatch(list, venue, new Date()));
      if (token) (adding ? userSyncApi.addWatch(token, venue.id) : userSyncApi.removeWatch(token, venue.id)).catch(() => {});
      if (Platform.OS !== 'web' && watchNotifications) Notifications.requestPermissionsAsync().catch(() => {});
    },
    [setWatches, watchNotifications, watches, premium, token],
  );

  // While the app is open, check watched venues and notify once new check-ins say Sakin
  useEffect(() => {
    if (watches.length === 0) return;
    const check = async () => {
      // After 6 hours the bell turns itself off
      const expired = watches.filter((w) => watchExpired(w, new Date()));
      if (expired.length > 0) return setWatches((list) => list.filter((w) => !watchExpired(w, new Date())));
      try {
        const venues = await fetchVenuesByIds(watches.map((w) => w.venueId));
        const emptied = venues.filter((v) => watches.some((w) => w.venueId === v.id && watchTriggered(v, w)));
        if (emptied.length === 0) return;
        setWatches((list) => list.filter((w) => !emptied.some((v) => v.id === w.venueId)));
        // Notified once: the bell is off on every phone (expired ones the server leaves out by itself)
        if (token) emptied.forEach((v) => userSyncApi.removeWatch(token, v.id).catch(() => {}));
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
  }, [watches, setWatches, watchNotifications, notify, token]);

  const setPhoto = useCallback(
    (venueId: number, uri: string) => setPhotos((p) => ({ ...p, [venueId]: uri })),
    [setPhotos],
  );

  return (
    <EngagementContext.Provider
      value={{
        userKey,
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
