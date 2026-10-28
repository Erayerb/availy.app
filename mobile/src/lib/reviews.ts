/** v2: venue reviews and replies on the server, and the feed (Sosyal > Akış: mine, Arkadaşlarım: friends'). */
import { send } from './accountApi.ts';

export const MAX_REVIEW = 280;
// Same as the server: each check-in at a venue allows two reviews there
export const MAX_REVIEWS_PER_CHECKIN = 2;
// Same as the server: replies one person may write under one review
export const MAX_REPLIES_PER_PERSON = 2;

export type Reply = {
  id: number;
  username: string | null;
  body: string;
  created_at: string;
  mine: boolean;
  is_business?: boolean; // written by the venue's own business ("İşletme")
};
export type Review = {
  id: number;
  username: string | null;
  rating: number;
  body: string;
  allow_replies: boolean;
  created_at: string;
  mine: boolean;
  replies: Reply[];
};
// Mine at this venue; null without an account
export type Allowance = { checkins: number; left: number };
export type Reviews = { average: number | null; count: number; items: Review[]; allowance?: Allowance | null };
export const NO_REVIEWS: Reviews = { average: null, count: 0, items: [] };

export type FeedItem = {
  kind: 'checkin' | 'review' | 'reply';
  at: string;
  username: string | null;
  venue_id: number;
  venue_name: string;
  is_first: boolean;
  points: number;
  rating: number | null;
  body: string | null;
  review_author: string | null;
  review_id: number | null; // review / reply: answer it from the feed
  allow_replies: boolean;
  // Check-in: its id, likes and friends' comments (rating / body: the review written with it)
  checkin_id?: number | null;
  likes?: number;
  liked?: boolean;
  likers?: string[]; // the last 3 who liked it
  comments?: CheckinComment[];
  replies?: CheckinComment[]; // my own Akış: replies under my review
};

export type CheckinComment = { id: number; username: string | null; body: string; at: string; mine: boolean };

/** Check-ins: friends' likes and comments. */
export const checkinSocialApi = {
  like: (token: string, checkinId: number, liked: boolean) =>
    send<void>('PUT', `/v1/checkins/${checkinId}/like`, { liked }, token),
  comment: (token: string, checkinId: number, body: string) =>
    send<{ id: number }>('POST', `/v1/checkins/${checkinId}/comments`, { body }, token),
  removeComment: (token: string, commentId: number) => send<void>('DELETE', `/v1/checkin-comments/${commentId}`, undefined, token),
};

export const reviewsApi = {
  list: (venueId: number, token?: string) => send<Reviews>('GET', `/v1/venues/${venueId}/reviews`, undefined, token),
  // checkinId: written right after that check-in ("Burası nasıl?"), shown with it in Akış
  write: (token: string, venueId: number, rating: number, body: string, allowReplies: boolean, checkinId?: number) =>
    send<Reviews>(
      'POST',
      `/v1/venues/${venueId}/reviews`,
      { rating, body, allow_replies: allowReplies, checkin_id: checkinId ?? null },
      token,
    ),
  edit: (token: string, reviewId: number, rating: number, body: string) =>
    send<Reviews>('PATCH', `/v1/reviews/${reviewId}`, { rating, body }, token),
  remove: (token: string, reviewId: number) => send<void>('DELETE', `/v1/reviews/${reviewId}`, undefined, token),
  reply: (token: string, reviewId: number, body: string) =>
    send<{ id: number }>('POST', `/v1/reviews/${reviewId}/replies`, { body }, token),
  removeReply: (token: string, replyId: number) => send<void>('DELETE', `/v1/replies/${replyId}`, undefined, token),
  // The last 3 days; "Daha eski" asks for 7
  // who: "me" = Sosyal > Akış (my own), "friends" = Sosyal > Arkadaşlarım
  feed: (token: string, days = 3, who: 'me' | 'friends' = 'friends') =>
    send<FeedItem[]>('GET', `/v1/feed?days=${days}&who=${who}`, undefined, token),
};

/** "@ayse" (guests and deleted accounts have no user name). */
export const author = (username: string | null) => (username ? `@${username}` : 'Misafir');

/** My newest review in a venue's list (the one just written). */
export const newestMine = (reviews: Reviews): Review | null =>
  reviews.items.filter((r) => r.mine).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

export type DaySection = { title: string; items: FeedItem[] };

/**
 * Akış: one heading per date ("Bugün", "Dün", "25 Ekim Cumartesi"); what is older
 * than `recentDays` days (shown with "Daha eski") goes under "Daha eski". Items arrive newest first.
 */
export function daySections(items: FeedItem[], now = new Date(), recentDays = 3): DaySection[] {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const sections: DaySection[] = [];
  for (const item of items) {
    const at = new Date(item.at);
    const days = Math.round((start(now) - start(at)) / 86_400_000);
    const title =
      days >= recentDays
        ? 'Daha eski'
        : days === 0
          ? 'Bugün'
          : days === 1
            ? 'Dün'
            : at.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
    const last = sections[sections.length - 1];
    if (last?.title === title) last.items.push(item);
    else sections.push({ title, items: [item] });
  }
  return sections;
}
