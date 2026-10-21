import { useCallback, useEffect, useState } from 'react';

import { NO_REVIEWS, reviewsApi, type Reviews } from '../lib/reviews';

/** A venue's reviews from the server; `reload` after writing, replying or deleting. */
export function useReviews(venueId: number, token: string | undefined) {
  const [reviews, setReviews] = useState<Reviews>(NO_REVIEWS);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    reviewsApi
      .list(venueId, token)
      .then((data) => {
        setReviews(data);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Yorumlar yüklenemedi.'));
  }, [venueId, token]);

  useEffect(reload, [reload]);
  return { reviews, setReviews, error, reload };
}
