import * as Notifications from 'expo-notifications';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { isAfter, phoneNotificationText, socialApi, unreadCount, type AppNotification } from '../lib/social';
import { KEYS, loadJson, saveJson } from '../lib/storage';
import { useSettings } from './SettingsContext';

// How often the list is checked while the app is open (server push comes with the release build)
const POLL_MS = 60_000;

type Value = {
  items: AppNotification[];
  unread: number;
  // The 🔔 list was opened: everything so far is read
  markSeen: () => void;
  reload: () => void;
  // 🗑 on one item, and "Temizle" for all; gone for good (on the server)
  dismiss: (key: string) => void;
  clear: () => void;
};

const NotificationsContext = createContext<Value>({
  items: [],
  unread: 0,
  markSeen: () => {},
  reload: () => {},
  dismiss: () => {},
  clear: () => {},
});

type Props = { token: string | null; accountKey: string | null; children: ReactNode };

/** v2 🔔: friend requests, accepted requests and replies to my reviews; new ones also as a phone notification. */
export function NotificationsProvider({ token, accountKey, children }: Props) {
  const settings = useSettings();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  // Newest item already announced, so each one is announced once
  const announced = useRef<string | null>(null);
  // Which kinds also come as phone notifications (Bildirim ayarları > Sosyal)
  const wanted = useRef<Record<AppNotification['kind'], boolean>>({} as Record<AppNotification['kind'], boolean>);
  wanted.current = {
    friend_request: settings.friendNotifications,
    group_invite: settings.friendNotifications,
    friend_accepted: settings.friendAcceptedNotifications,
    reply: settings.replyNotifications,
    checkin_comment: settings.checkinCommentNotifications,
    checkin_like: settings.checkinLikeNotifications,
    // A venue's reward and a new loyalty program are always shown
    reward: true,
    loyalty: true,
    // The business's own alerts (Ayarlar > Ölü saat bildirimi turns them off on the server)
    dead_hour: true,
    auto_campaign: true,
  };

  useEffect(() => {
    setItems([]);
    announced.current = null;
    if (!accountKey) return setLastSeen(null);
    loadJson<Record<string, string>>(KEYS.notificationsSeen).then((all) => setLastSeen(all?.[accountKey] ?? null));
  }, [accountKey]);

  const reload = useCallback(() => {
    if (!token) return;
    socialApi
      .notifications(token)
      .then((list) => {
        setItems(list);
        const newest = list[0]?.at ?? null;
        // The first load only sets the marker: old items are not announced again
        const since = announced.current;
        if (since !== null && Platform.OS !== 'web') {
          for (const n of list.filter((n) => !since || isAfter(n.at, since))) {
            if (wanted.current[n.kind] ?? true) Notifications.scheduleNotificationAsync({ content: { title: 'availy', body: phoneNotificationText(n) }, trigger: null }).catch(() => {});
          }
        }
        if (newest && (!announced.current || isAfter(newest, announced.current))) announced.current = newest;
        if (announced.current === null) announced.current = '';
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    reload();
    const timer = setInterval(() => AppState.currentState === 'active' && reload(), POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const markSeen = useCallback(() => {
    if (!accountKey) return;
    const now = new Date().toISOString();
    setLastSeen(now);
    loadJson<Record<string, string>>(KEYS.notificationsSeen).then((all) =>
      saveJson(KEYS.notificationsSeen, { ...(all ?? {}), [accountKey]: now }),
    );
  }, [accountKey]);

  const dismiss = useCallback(
    (key: string) => {
      if (!token) return;
      setItems((list) => list.filter((n) => n.key !== key));
      socialApi.dismissNotification(token, key).catch(reload);
    },
    [token, reload],
  );

  const clear = useCallback(() => {
    if (!token) return;
    setItems([]);
    socialApi.clearNotifications(token).catch(reload);
  }, [token, reload]);

  return (
    <NotificationsContext.Provider value={{ items, unread: unreadCount(items, lastSeen), markSeen, reload, dismiss, clear }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationsContext);
