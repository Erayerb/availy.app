/** Customer ratings and short comments about a venue (prototype: on this phone). */
export type Feedback = {
  id: string;
  venueId: number;
  userKey: string;
  userName: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
};

export const MAX_COMMENT = 280;

export function validateFeedback(rating: number, comment: string): string | null {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return 'Puan seç (1–5).';
  if (comment.length > MAX_COMMENT) return `Yorum en fazla ${MAX_COMMENT} karakter olabilir.`;
  return null;
}

/** One review per customer and venue: a new one replaces the old. */
export function addFeedback(list: Feedback[], item: Feedback): Feedback[] {
  return [item, ...list.filter((f) => !(f.venueId === item.venueId && f.userKey === item.userKey))];
}

export function venueRating(list: Feedback[], venueId: number) {
  const mine = list.filter((f) => f.venueId === venueId);
  const average = mine.length ? Math.round((mine.reduce((s, f) => s + f.rating, 0) / mine.length) * 10) / 10 : null;
  return { average, count: mine.length, items: mine };
}

export const stars = (rating: number) => '★'.repeat(rating) + '☆'.repeat(5 - rating);
