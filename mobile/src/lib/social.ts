/** v2: leaderboard, notifications and privacy settings on the server. */
import { send } from './accountApi.ts';

export type Period = 'week' | 'all';
export type Scope = 'friends' | 'everyone' | 'group';
export type RankRow = { rank: number; username: string | null; points: number; me: boolean; level?: string | null };
export type Leaderboard = { rows: RankRow[]; me: { rank: number; points: number } | null; last_week_winners?: string[] };

export type AppNotification = {
  kind:
    | 'friend_request'
    | 'friend_accepted'
    | 'reply'
    | 'reward'
    | 'loyalty'
    | 'checkin_like'
    | 'checkin_comment'
    | 'group_invite'
    // The business: its venue is quiet, and the campaign sent for it automatically
    | 'dead_hour'
    | 'auto_campaign'
    // A friend after a check-in: "Buradayım, gel"
    | 'come_here'
    | 'friend_checkin' // a friend checked in
    | 'venue_campaign' // a favourite (or a venue I went to lately) started a campaign; body: its message
    | 'campaign_last_hour' // a favourite's campaign in its last hour; body: "20|message"
    | 'regular_lost' // someone took my place as a venue's regular (username: null when they keep it to friends)
    | 'friend_review' // a friend reviewed a venue; body: "4★ text"
    | 'favorite_quiet' // availo+: a busy favourite turned quiet
    | 'comeback' // 4 days without a check-in (the one reminder that is not an event); body: the text
    // The business: a coupon used, 80% of the coupons taken (body "8/10"), a campaign over (body "seen,taken,used")
    | 'coupon_redeemed'
    | 'coupon_limit'
    | 'campaign_ended'
    | 'monthly_report' // the business, from the 1st: last month with availo (body "people,new,coupons")
    | 'trial_ended' // the 15-day trial of the Aylık paket
    | 'founder_ended' // kurucu mekan: the 3 free months
    | 'together' // a friend checked in where I was: points for both
    | 'venue_approved' // a venue I added
    | 'invite_joined' // signed up through my link
    | 'loyalty_reward' // a stamp card filled up (done: used)
    | 'weekly_winner' // body: the points
    | 'support_reply' // body: the answer
    | 'moment_removed'
    | 'moment_report_result' // body: kept / removed
    | 'report_result' // a review or reply I reported; body: kept / removed
    | 'watch_quiet' // "Sakin olunca haber ver"
    // The business
    | 'new_review' // body: "4★ text"
    | 'sponsor_started'
    | 'sponsor_ended'
    | 'venue_issue'; // body: closed / hours / location / name / offensive_name
  at: string;
  username: string | null;
  venue_id: number | null;
  venue_name: string | null;
  body: string | null;
  done?: boolean; // a request accepted, a loyalty program joined
  key: string; // for deleting it
};

export type Suggestions = {
  people: { username: string; mutual: number; shared_venues: number; week_points: number }[];
  venues: {
    id: number;
    name: string;
    category: string;
    neighborhood: string;
    district: string;
    discovered_at: string;
    username: string | null; // null when the first check-in was private
    distance_m: number | null;
  }[];
};

export type Privacy = {
  share_checkins: boolean;
  show_in_leaderboard: boolean;
  searchable: boolean;
  suggest_by_venues: boolean; // suggested to people who check in at the same venues
  regular_public: boolean; // "Buranın müdavimi" shown to everyone, not only to friends
  stats_visibility: 'friends' | 'me'; // who sees the statistics on my profile
  moment_audience?: 'everyone' | 'friends'; // "Şu an burada" photos: the choice when sharing
};

export const socialApi = {
  // "Buradayım, gel" after a check-in
  callFriends: (token: string, checkinId: number) => send<{ friends: number }>('POST', `/v1/checkins/${checkinId}/call-friends`, undefined, token),
  // scope "group": the members of `groupId`
  leaderboard: (token: string, period: Period, scope: Scope, groupId?: number) =>
    send<Leaderboard>(
      'GET',
      `/v1/leaderboard?period=${period}&scope=${scope}${scope === 'group' && groupId ? `&group=${groupId}` : ''}`,
      undefined,
      token,
    ),
  // For an empty Akış: people to add and venues discovered nearby lately
  suggestions: (token: string, point: { lat: number; lon: number } | null) =>
    send<Suggestions>('GET', `/v1/suggestions${point ? `?lat=${point.lat}&lon=${point.lon}` : ''}`, undefined, token),
  // When the 🔔 list was last opened, on any phone (the unread count starts after it)
  notificationsSeen: (token: string) => send<{ at: string | null }>('GET', '/v1/me/notifications-seen', undefined, token),
  saveNotificationsSeen: (token: string, at: string) => send<void>('PUT', '/v1/me/notifications-seen', { at }, token),
  notifications: (token: string) => send<AppNotification[]>('GET', '/v1/notifications', undefined, token),
  dismissNotification: (token: string, key: string) => send<void>('POST', '/v1/notifications/dismiss', { key }, token),
  clearNotifications: (token: string) => send<void>('DELETE', '/v1/notifications', undefined, token),
  // The phone's Expo push address: 🔔 items reach it while the app is closed
  savePushToken: (token: string, pushToken: string, platform: string) =>
    send<void>('PUT', '/v1/me/push-token', { token: pushToken, platform }, token),
  removePushToken: (token: string, pushToken: string) => send<void>('DELETE', '/v1/me/push-token', { token: pushToken }, token),
  privacy: (token: string) => send<Privacy & Record<string, unknown>>('GET', '/v1/me', undefined, token),
  setPrivacy: (token: string, patch: Partial<Privacy>) => send<Privacy>('PATCH', '/v1/me/privacy', patch, token),
};

/** Notifications newer than the last time the list was opened. */
export const unreadCount = (items: AppNotification[], lastSeen: string | null) =>
  lastSeen ? items.filter((n) => isAfter(n.at, lastSeen)).length : items.length;

/** Compares times, not text: the server writes "+00:00", the phone "Z". */
export const isAfter = (a: string, b: string) => new Date(a).getTime() > new Date(b).getTime();

// Emoji for phone notifications (text only there); the 🔔 list draws its own icons
export const NOTIFICATION_ICONS: Record<AppNotification['kind'], string> = {
  friend_request: '👋',
  friend_accepted: '🤝',
  reply: '💬',
  reward: '🎁',
  loyalty: '⭐',
  checkin_like: '♥',
  checkin_comment: '💬',
  group_invite: '👥',
  dead_hour: '🌙',
  auto_campaign: '📣',
  come_here: '📍',
  friend_checkin: '📍',
  venue_campaign: '🏷️',
  campaign_last_hour: '⏳',
  regular_lost: '🏠',
  friend_review: '⭐',
  favorite_quiet: '♥',
  comeback: '👋',
  coupon_redeemed: '🎟️',
  coupon_limit: '⏳',
  campaign_ended: '📊',
  monthly_report: '📈',
  trial_ended: '⏰',
  founder_ended: '⏰',
  together: '👯',
  venue_approved: '✅',
  invite_joined: '🎉',
  loyalty_reward: '🎁',
  weekly_winner: '🏆',
  support_reply: '💬',
  moment_removed: '📷',
  moment_report_result: '🛡️',
  report_result: '🛡️',
  watch_quiet: '🔔',
  new_review: '⭐',
  sponsor_started: '📣',
  sponsor_ended: '📣',
  venue_issue: '⚠️',
};

const ISSUES: Record<string, string> = {
  closed: 'kapandığı',
  hours: 'saatlerinin yanlış olduğu',
  location: 'konumunun yanlış olduğu',
  name: 'adının yanlış olduğu',
  offensive_name: 'adının uygunsuz olduğu',
};

/** One line for a notification (the 🔔 list shows its icon next to it). */
export function notificationText(n: AppNotification): string {
  const who = n.username ? `@${n.username}` : 'Biri';
  if (n.kind === 'friend_request')
    return n.done ? `${who} ile artık arkadaşsınız.` : `${who} seni arkadaş olarak eklemek istiyor.`;
  if (n.kind === 'come_here') return `${who} şu an ${n.venue_name} mekanında: "Buradayım, gel!"`;
  if (n.kind === 'friend_accepted') return `${who} arkadaşlık isteğini kabul etti.`;
  if (n.kind === 'checkin_like') return `${who} ${n.venue_name} check-in'ini beğendi.`;
  if (n.kind === 'checkin_comment') return `${who} ${n.venue_name} check-in'ine yorum yaptı: "${n.body}"`;
  if (n.kind === 'loyalty')
    return `Check-in yaptığın ${n.venue_name} sadakat programı başlattı: ${n.body}.${n.done ? ' Katıldın.' : ' Katılmak için dokun.'}`;
  if (n.kind === 'group_invite')
    return n.done ? `"${n.body}" grubuna katıldın.` : `${who} seni "${n.body}" grubuna davet etti. Katılmak için dokun.`;
  if (n.kind === 'dead_hour') return `${n.venue_name} şu an sakin görünüyor. Kampanya başlat, yakındakilere ulaş!`;
  if (n.kind === 'comeback') return n.body ?? 'Bir süredir check-in yapmadın.';
  if (n.kind === 'coupon_redeemed') return `Kuponun kullanıldı: "${n.body}"`;
  if (n.kind === 'coupon_limit') return `Kampanyanın kuponları dolmak üzere (${n.body}).`;
  if (n.kind === 'monthly_report') {
    const [people, fresh, used] = (n.body ?? '').split(',');
    return used !== undefined ? `Geçen ay availo ile ${people} kişi geldi, ${fresh}'i ilk kez; ${used} kupon kullanıldı.` : "Geçen ayın availo raporu hazır.";
  }
  if (n.kind === 'trial_ended') return "Aylık paket denemen bitti. Sınırsız kampanya ve istatistikler için Aylık paket'e geç.";
  if (n.kind === 'founder_ended') return "Kurucu mekan olarak 3 aylık ücretsiz Aylık paketin bitti. Devam etmek için Abonelik'e bak; rozetin kalıyor.";
  if (n.kind === 'campaign_ended') {
    const [seen, taken, used] = (n.body ?? '').split(',');
    return used !== undefined ? `Kampanyan bitti: ${seen} kişi gördü, ${taken} kupon alındı, ${used} kullanıldı.` : 'Kampanyan bitti.';
  }
  if (n.kind === 'auto_campaign') return `Ölü saat için otomatik kampanya gönderildi: "${n.body}"`;
  // Fresh (a check-in's own life): "Sen de katıl!"; older ones only say where they went
  if (n.kind === 'friend_checkin')
    return Date.now() - new Date(n.at).getTime() < 90 * 60_000
      ? `${who} şu an ${n.venue_name} mekanında. Sen de katıl!`
      : `${who} ${n.venue_name} mekanında check-in yaptı.`;
  if (n.kind === 'regular_lost')
    return n.username ? `${n.venue_name} mekanındaki müdavimliğini @${n.username} aldı.` : `${n.venue_name} mekanındaki müdavimliğini başkası aldı.`;
  if (n.kind === 'campaign_last_hour') {
    const discount = (n.body ?? '').split('|')[0];
    return discount ? `${n.venue_name}: kampanyanın son 1 saati, %${discount} indirim` : `${n.venue_name}: kampanyanın son 1 saati`;
  }
  if (n.kind === 'venue_campaign') return `${n.venue_name} kampanya başlattı: "${n.body}"`;
  if (n.kind === 'friend_review') return `${who} ${n.venue_name} için yorum yazdı: ${n.body}`;
  if (n.kind === 'favorite_quiet') return `Favorin ${n.venue_name} şu an sakin. Gitmek için iyi bir zaman.`;
  if (n.kind === 'together') return `${who} de ${n.venue_name} mekanına geldi: birlikte check-in, ikiniz de puan kazandınız.`;
  if (n.kind === 'venue_approved') return `Eklediğin ${n.venue_name} onaylandı, artık herkes görüyor. Puanın hesabında.`;
  if (n.kind === 'invite_joined') return `${who} davetinle katıldı; artık arkadaşsınız.`;
  if (n.kind === 'loyalty_reward')
    return n.done ? `${n.venue_name} ödülünü kullandın.` : `${n.venue_name} damga kartın doldu! Ödülün hazır: ${n.body}. Kasada göster.`;
  if (n.kind === 'weekly_winner') return `Tebrikler! Geçen haftanın 1.'si sensin (${n.body} puan).`;
  if (n.kind === 'support_reply') return `Destek ekibi yanıtladı: "${n.body}"`;
  if (n.kind === 'moment_removed') return `${n.venue_name} fotoğrafın kurallara uymadığı için kaldırıldı.`;
  if (n.kind === 'moment_report_result' || n.kind === 'report_result') {
    const what = n.kind === 'moment_report_result' ? 'fotoğraf' : 'yorum';
    return n.body === 'removed'
      ? `Bildirdiğin ${what} (${n.venue_name}) incelendi ve kaldırıldı. Teşekkürler.`
      : `Bildirdiğin ${what} (${n.venue_name}) incelendi; kurallara aykırı bulunmadı.`;
  }
  if (n.kind === 'watch_quiet') return `${n.venue_name} sakinleşti. Gitmek için iyi bir zaman.`;
  if (n.kind === 'new_review') return `${who} ${n.venue_name} için yorum yazdı: ${n.body}`;
  if (n.kind === 'sponsor_started') return `"Öne çık" yayında: ${n.venue_name} ana sayfada en üstte görünüyor.`;
  if (n.kind === 'sponsor_ended') return `"Öne çık" süren bitti. Yeniden öne çıkmak için İşletme paneline bak.`;
  if (n.kind === 'venue_issue')
    return `Biri ${n.venue_name} mekanının ${ISSUES[n.body ?? ''] ?? 'bilgisinin yanlış olduğu'}nu bildirdi.${n.done ? ' Düzeltildi.' : ' Bilgileri kontrol et.'}`;
  if (n.kind === 'reward') return `${n.venue_name} keşfettiğin için sana ödül verdi: "${n.body}" Kasada bu bildirimi göster.`;
  return `${who} yorumunu yanıtladı (${n.venue_name}): "${n.body}"`;
}

/** As a phone notification, where there is no icon next to it. */
export const phoneNotificationText = (n: AppNotification) => `${NOTIFICATION_ICONS[n.kind]} ${notificationText(n)}`;

/** "Bugün", "Bu hafta" (the last 7 days) and "Daha eski"; empty groups are left out. */
export function groupByAge<T extends { at: string }>(items: T[], now: Date): { title: string; items: T[] }[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const week = today - 6 * 86_400_000;
  const groups = [
    { title: 'Bugün', items: items.filter((n) => new Date(n.at).getTime() >= today) },
    { title: 'Bu hafta', items: items.filter((n) => new Date(n.at).getTime() < today && new Date(n.at).getTime() >= week) },
    { title: 'Daha eski', items: items.filter((n) => new Date(n.at).getTime() < week) },
  ];
  return groups.filter((g) => g.items.length > 0);
}
