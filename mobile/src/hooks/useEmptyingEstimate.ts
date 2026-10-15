import { useEffect, useState } from 'react';

import { fetchForecast, type Venue } from '../lib/api';
import { EMPTY_THRESHOLD, emptyingEstimate, estimateText } from '../lib/forecast';

/** "Tahmini boşalma: ~15:20" for an open venue at or above 75%; null otherwise. */
export function useEmptyingEstimate(venue: Venue | undefined): string | null {
  const busy = venue !== undefined && venue.open_now && venue.occupancy.ratio >= EMPTY_THRESHOLD;
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    setText(null);
    if (!busy || !venue) return;
    const controller = new AbortController();
    fetchForecast(venue.id, controller.signal)
      .then((points) => setText(estimateText(emptyingEstimate(points, EMPTY_THRESHOLD))))
      .catch(() => {});
    return () => controller.abort();
    // Recompute when the venue's occupancy updates
  }, [busy, venue?.id, venue?.occupancy.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  return text;
}
