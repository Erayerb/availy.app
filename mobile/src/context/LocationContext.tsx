import { createContext, useContext, type ReactNode } from 'react';

import { useUserLocation, type UserLocation } from '../hooks/useUserLocation';

const LocationContext = createContext<UserLocation>({ point: null, loading: false });

/** Asks for location permission once and shares the result with every screen. */
export function LocationProvider({ children }: { children: ReactNode }) {
  return <LocationContext.Provider value={useUserLocation()}>{children}</LocationContext.Provider>;
}

export const useLocation = () => useContext(LocationContext);
