/**
 * "Notify me" watches and older venue photos, stored on this phone, and the in-app alert banner.
 * (Coupons: CampaignsContext, loyalty: LoyaltyContext, both on the server.)
 */
import * as Notifications from 'expo-notifications';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { usePersistentState } from '../hooks/usePersistentState';
import { fetchVenuesByIds } from '../lib/api';
import { canAddWatch, FREE_WATCH_LIMIT } from '../lib/premium';
import { KEYS } from '../lib/storage';
import { notificationText, parseWatches, toggleWatch, watchTriggered, type Watch } from '../lib/watch';
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

export function EngagementProvider({ userKey, children }: { userKey: string; children: ReactNode }) {
  const { watchNotifications, premium } = useSettings();
  const [watches, setWatches] = usePersistentState<Watch[]>(KEYS.watches, [], parseWatches);
  const [photos, setPhotos] = usePersistentState<Record<string, string>>(KEYS.photos, {}, asRecord);
  const [alert, setAlert] = useState<string | null>(null);

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
