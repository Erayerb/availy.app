import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { FAVORITES_REQUIRE_LOGIN, parseFavorites, toggleFavorite } from '../lib/favorites';
import { KEYS, loadJson, saveJson } from '../lib/storage';

type Favorites = {
  ids: number[];
  isFavorite: (id: number) => boolean;
  toggle: (id: number) => void;
};

const FavoritesContext = createContext<Favorites | null>(null);

type Props = {
  signedIn: boolean;
  onLoginRequired: () => void;
  children: ReactNode;
};

/** Favorite venue ids, kept on the device. */
export function FavoritesProvider({ signedIn, onLoginRequired, children }: Props) {
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    loadJson<unknown>(KEYS.favorites).then((raw) => setIds(parseFavorites(raw)));
  }, []);

  const toggle = useCallback(
    (id: number) => {
      if (FAVORITES_REQUIRE_LOGIN && !signedIn) {
        onLoginRequired();
        return;
      }
      setIds((current) => {
        const next = toggleFavorite(current, id);
        saveJson(KEYS.favorites, next);
        return next;
      });
    },
    [signedIn, onLoginRequired],
  );

  const isFavorite = useCallback((id: number) => ids.includes(id), [ids]);

  return (
    <FavoritesContext.Provider value={{ ids, isFavorite, toggle }}>{children}</FavoritesContext.Provider>
  );
}

export function useFavorites(): Favorites {
  const value = useContext(FavoritesContext);
  if (!value) throw new Error('useFavorites must be used inside FavoritesProvider');
  return value;
}
