import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { fetchVenues, type Venue } from '../lib/api';
import type { Visit } from '../lib/checkinApi';
import { distanceKm, type LatLon } from '../lib/geo';
import { bboxAround, nearestOpenVenue } from '../lib/nearby';
import { KEYS, loadJson, saveJson } from '../lib/storage';
import { mayAsk, nextStay, rememberAsked, shouldSuggest, SUGGEST_RADIUS_KM, suggestionText, type Asked, type Stay } from '../lib/suggestion';

// Venues around the user are fetched again after walking this far
const REFETCH_KM = 0.15;
// Checked this often, so a stay of a few minutes is noticed even when the position stops changing
const TICK_MS = 30_000;

export type Suggestion = { venue: Venue; visits: number };

/**
 * v2: "Mado yakınındasın, burası şu an nasıl?" after a few minutes within 150 m of an open venue.
 * In the app a banner; a phone notification only when the app is in the background. At most every
 * hour, and twice a day for the same venue (lib/suggestion).
 */
export function useCheckinSuggestion(point: LatLon | null, visits: Visit[], enabled: boolean) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const fetchedAt = useRef<LatLon | null>(null);
  const stay = useRef<Stay | null>(null);
  // null: not read yet, so nothing is asked
  const asked = useRef<Asked | null>(null);
  useEffect(() => {
    loadJson<Asked>(KEYS.suggestionsAsked).then((saved) => {
      asked.current = saved ?? {};
    });
  }, []);
  const latest = useRef({ point, visits, venues, enabled });
  latest.current = { point, visits, venues, enabled };

  // Nearby venues, refreshed when the user has moved a bit
  useEffect(() => {
    if (!enabled || !point) return;
    if (fetchedAt.current && distanceKm(fetchedAt.current, point) < REFETCH_KM) return;
    fetchedAt.current = point;
    fetchVenues(bboxAround(point, 0.006), []).then(setVenues).catch(() => {});
  }, [enabled, point]);

  const check = useCallback(() => {
    const { point, visits, venues, enabled } = latest.current;
    if (!enabled || !point) {
      stay.current = null;
      return;
    }
    const venue = nearestOpenVenue(venues, point, SUGGEST_RADIUS_KM);
    const now = Date.now();
    stay.current = nextStay(stay.current, venue?.id ?? null, now);
    // Walked away: the banner goes too
    if (!venue) return setSuggestion(null);
    const visit = visits.find((v) => v.venue_id === venue.id);
    if (!shouldSuggest(stay.current, now, visit ? new Date(visit.last_at).getTime() : null)) return;
    if (!asked.current || !mayAsk(asked.current, venue.id, now)) return;
    stay.current = { ...stay.current!, suggested: true };
    asked.current = rememberAsked(asked.current, venue.id, now);
    saveJson(KEYS.suggestionsAsked, asked.current);
    setSuggestion({ venue, visits: visit?.visits ?? 0 });
    if (Platform.OS !== 'web' && AppState.currentState !== 'active') {
      Notifications.scheduleNotificationAsync({
        content: { ...suggestionText(venue.name, visit?.visits ?? 0), data: { venueId: venue.id } },
        trigger: null,
      }).catch(() => {});
    }
  }, []);

  useEffect(check, [check, point, venues]);
  useEffect(() => {
    const timer = setInterval(check, TICK_MS);
    return () => clearInterval(timer);
  }, [check]);

  return { suggestion, dismiss: () => setSuggestion(null) };
}
