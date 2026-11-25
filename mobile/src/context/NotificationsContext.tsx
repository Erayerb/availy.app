import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { isAfter, phoneNotificationText, socialApi, unreadCount, type AppNotification } from '../lib/social';
import { KEYS, loadJson, saveJson } from '../lib/storage';
import { useSettings } from './SettingsContext';

// How often the list is checked while the app is open
const POLL_MS = 60_000;
// EAS project (app.json > extra.eas.projectId, set by `eas init`): without it there is no server push
const PROJECT_ID: string | undefined = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

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
  // This phone's push address, once the server has it: the server sends the phone notifications then
  // (also while the app is closed), so the app does not announce them itself
  const pushed = useRef<{ token: string; push: string } | null>(null);

  useEffect(() => {
    if (!token || Platform.OS === 'web' || !PROJECT_ID) return;
    let alive = true;
    (async () => {
      // Asked once after signing in (the phone asks only while undetermined); "Hayır" is respected
      let { status } = await Notifications.getPermissionsAsync();
      if (status === 'undetermined') status = (await Notifications.requestPermissionsAsync()).status;
      if (status !== 'granted') return;
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
      await socialApi.savePushToken(token, data, Platform.OS);
      if (alive) pushed.current = { token, push: data };
    })().catch(() => {});
    return () => {
      alive = false;
      // Signed out (or another account): this phone gets nothing more for that account
      const was = pushed.current;
      pushed.current = null;
      if (was) socialApi.removePushToken(was.token, was.push).catch(() => {});
    };
  }, [token]);
  // Which kinds also come as phone notifications (Bildirim ayarları > Sosyal)
  const wanted = useRef<Record<AppNotification['kind'], boolean>>({} as Record<AppNotification['kind'], boolean>);
  wanted.current = {
    friend_request: settings.friendNotifications,
    group_invite: settings.friendNotifications,
    come_here: settings.friendNotifications,
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
    friend_checkin: settings.friendCheckinNotifications,
    venue_campaign: settings.campaignNotifications,
    campaign_last_hour: settings.campaignNotifications,
    regular_lost: true,
    friend_review: settings.friendCheckinNotifications,
    favorite_quiet: settings.favoriteQuietNotifications,
    comeback: true,
    coupon_redeemed: true,
    coupon_limit: true,
    campaign_ended: true,
    monthly_report: true,
    trial_ended: true,
    founder_ended: true,
    together: settings.friendNotifications,
    invite_joined: settings.friendNotifications,
    venue_approved: true,
    loyalty_reward: true,
    weekly_winner: true,
    support_reply: true,
    moment_removed: true,
    moment_report_result: true,
    report_result: true,
    // The phone already tells it itself while the app runs (EngagementContext); not twice
    watch_quiet: false,
    new_review: true,
    sponsor_started: true,
    sponsor_ended: true,
    venue_issue: true,
  };

  useEffect(() => {
    setItems([]);
    announced.current = null;
    if (!accountKey) return setLastSeen(null);
    // This phone's copy first, then the server's (the list opened on another phone counts too): the later one
    loadJson<Record<string, string>>(KEYS.notificationsSeen).then((all) => {
      const local = all?.[accountKey] ?? null;
      setLastSeen(local);
      if (!token) return;
      socialApi
        .notificationsSeen(token)
        .then(({ at }) => at && setLastSeen((now) => (!now || isAfter(at, now) ? at : now)))
        .catch(() => {});
    });
  }, [accountKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(() => {
    if (!token) return;
    socialApi
      .notifications(token)
      .then((list) => {
        setItems(list);
        const newest = list[0]?.at ?? null;
        // The first load only sets the marker: old items are not announced again
        const since = announced.current;
        if (since !== null && Platform.OS !== 'web' && !pushed.current) {
          for (const n of list.filter((n) => !since || isAfter(n.at, since))) {
            if (wanted.current[n.kind] ?? true) Notifications.scheduleNotificationAsync({ content: { title: 'availo', body: phoneNotificationText(n), data: n.kind === 'come_here' && n.venue_id ? { venueId: n.venue_id } : { list: true } }, trigger: null }).catch(() => {});
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
    if (token) socialApi.saveNotificationsSeen(token, now).catch(() => {});
  }, [accountKey, token]);

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
