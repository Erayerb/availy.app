import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { friendsApi, friendsHereByVenue, type Friend } from '../lib/friends';

const REFRESH_MS = 2 * 60_000;

type Value = {
  here: (venueId: number) => Friend[]; // friends who checked in there within the hour, latest first
  openUser: (username: string) => void;
};

const FriendsHereContext = createContext<Value>({ here: () => [], openUser: () => {} });

/** Friends at a venue right now, for the venue cards: one friends list for every card (no request per card). */
export function FriendsHereProvider({ token, onOpenUser, children }: { token: string | null; onOpenUser: (username: string) => void; children: ReactNode }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [now, setNow] = useState(() => Date.now());
  // The latest navigation callback without re-rendering every card when the app re-renders
  const openRef = useRef(onOpenUser);
  openRef.current = onOpenUser;

  const load = useCallback(() => {
    setNow(Date.now());
    if (!token) return setFriends([]);
    friendsApi
      .list(token)
      .then((lists) => setFriends(lists.friends))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && load());
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [load]);

  const byVenue = useMemo(() => friendsHereByVenue(friends, now), [friends, now]);

  const value = useMemo<Value>(() => ({ here: (venueId) => byVenue.get(venueId) ?? [], openUser: (u) => openRef.current(u) }), [byVenue]);
  return <FriendsHereContext.Provider value={value}>{children}</FriendsHereContext.Provider>;
}

export const useFriendsHere = () => useContext(FriendsHereContext);
