import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { distanceKm, type LatLon } from '../lib/geo';

// Demo venues are in Istanbul; a position far from there is treated like "no location"
const ISTANBUL: LatLon = { lat: 41.03, lon: 29.01 };
const MAX_KM_FROM_DEMO_AREA = 50;

/** point is null while loading, without permission, or when the phone is outside the demo area. */
export type UserLocation = { point: LatLon | null; loading: boolean };

export function useUserLocation(): UserLocation {
  const [state, setState] = useState<UserLocation>({ point: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error('permission denied');
        const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const point = { lat: coords.latitude, lon: coords.longitude };
        const usable = distanceKm(point, ISTANBUL) <= MAX_KM_FROM_DEMO_AREA;
        if (!cancelled) setState({ point: usable ? point : null, loading: false });
      } catch {
        if (!cancelled) setState({ point: null, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
