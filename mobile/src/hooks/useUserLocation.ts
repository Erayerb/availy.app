import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import { distanceKm, type LatLon } from '../lib/geo';

// Demo venues are in Istanbul; a position far from there is treated like "no location"
const ISTANBUL: LatLon = { lat: 41.03, lon: 29.01 };
const MAX_KM_FROM_DEMO_AREA = 50;

/** Result of asking for the position right now (check-in): the raw position, or why there is none. */
export type Locate = { coords: LatLon; error: null } | { coords: null; error: 'denied' | 'blocked' | 'failed' };

/**
 * point is null while loading, without permission, or when the phone is outside the demo area.
 * `locate` asks again (permission and position) where the location is needed, e.g. for a check-in.
 */
export type UserLocation = {
  point: LatLon | null;
  loading: boolean;
  // The phone gives only an approximate place (iOS "Kesin Konum" / Android "yaklaşık" turned off): off by up to a few km
  approximate?: boolean;
  locate: () => Promise<Locate>;
};

/** iOS "Kesin Konum" off, or Android coarse only. */
const isApproximate = (p: Location.LocationPermissionResponse) => p.ios?.accuracy === 'reduced' || p.android?.accuracy === 'coarse';

export function useUserLocation(): UserLocation {
  const [state, setState] = useState<Omit<UserLocation, 'locate'>>({ point: null, loading: true });
  const watching = useRef<Location.LocationSubscription | null>(null);

  // Keep the map's blue dot following the phone once permission is given
  const follow = useCallback(async () => {
    if (watching.current) return;
    try {
      watching.current = await Location.watchPositionAsync(
        // High: GPS, not only Wi-Fi / cell towers (those can be off by a few hundred metres)
        { accuracy: Location.Accuracy.High, distanceInterval: 10 },
        ({ coords }) => {
          const point = { lat: coords.latitude, lon: coords.longitude };
          setState((old) => ({ ...old, point: distanceKm(point, ISTANBUL) <= MAX_KM_FROM_DEMO_AREA ? point : null, loading: false }));
        },
      );
    } catch {
      // Positions still come from `locate`
    }
  }, []);

  const locate = useCallback(async (): Promise<Locate> => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      // iOS does not ask again once denied: the user has to allow it in Settings
      if (permission.status !== 'granted') return { coords: null, error: permission.canAskAgain ? 'denied' : 'blocked' };
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const point = { lat: coords.latitude, lon: coords.longitude };
      setState({ point: distanceKm(point, ISTANBUL) <= MAX_KM_FROM_DEMO_AREA ? point : null, loading: false, approximate: isApproximate(permission) });
      follow();
      return { coords: point, error: null };
    } catch {
      return { coords: null, error: 'failed' };
    }
  }, [follow]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') throw new Error('permission denied');
        const approximate = isApproximate(permission);
        const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const point = { lat: coords.latitude, lon: coords.longitude };
        const usable = distanceKm(point, ISTANBUL) <= MAX_KM_FROM_DEMO_AREA;
        if (!cancelled) {
          setState({ point: usable ? point : null, loading: false, approximate });
          follow();
        }
      } catch {
        if (!cancelled) setState({ point: null, loading: false });
      }
    })();
    return () => {
      cancelled = true;
      watching.current?.remove();
      watching.current = null;
    };
  }, [follow]);

  return { ...state, locate };
}
