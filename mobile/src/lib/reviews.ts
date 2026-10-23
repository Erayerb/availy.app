/** v2: venue reviews and replies on the server, and the friends' feed (Sosyal > Akış). */
import { send } from './accountApi.ts';

export const MAX_REVIEW = 280;
// Same as the server: each check-in at a venue allows two reviews there
export const MAX_REVIEWS_PER_CHECKIN = 2;

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
};

export const reviewsApi = {
  list: (venueId: number, token?: string) => send<Reviews>('GET', `/v1/venues/${venueId}/reviews`, undefined, token),
  write: (token: string, venueId: number, rating: number, body: string, allowReplies: boolean) =>
    send<Reviews>('POST', `/v1/venues/${venueId}/reviews`, { rating, body, allow_replies: allowReplies }, token),
  remove: (token: string, reviewId: number) => send<void>('DELETE', `/v1/reviews/${reviewId}`, undefined, token),
  reply: (token: string, reviewId: number, body: string) =>
    send<{ id: number }>('POST', `/v1/reviews/${reviewId}/replies`, { body }, token),
  removeReply: (token: string, replyId: number) => send<void>('DELETE', `/v1/replies/${replyId}`, undefined, token),
  feed: (token: string) => send<FeedItem[]>('GET', '/v1/feed', undefined, token),
};

/** "@ayse" (guests and deleted accounts have no user name). */
export const author = (username: string | null) => (username ? `@${username}` : 'Misafir');

/** Feed in blocks: what one person did in a row stays together, the next person gets a new block. */
export function groupByPerson(items: FeedItem[]): { username: string | null; items: FeedItem[] }[] {
  const groups: { username: string | null; items: FeedItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.username === item.username) last.items.push(item);
    else groups.push({ username: item.username, items: [item] });
  }
  return groups;
}
