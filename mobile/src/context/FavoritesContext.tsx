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
  // Whose favorites: each account (and each guest) has its own list on the phone
  accountKey: string | null;
  signedIn: boolean;
  onLoginRequired: () => void;
  children: ReactNode;
};

/** Favorite venue ids, kept on the device per account. */
export function FavoritesProvider({ accountKey, signedIn, onLoginRequired, children }: Props) {
  const [ids, setIds] = useState<number[]>([]);
  // The older shared list (KEYS.favorites, before lists were per account) is left untouched
  const storageKey = accountKey ? `${KEYS.favorites}.${accountKey}` : null;

  useEffect(() => {
    setIds([]);
    if (!storageKey) return;
    let stale = false;
    loadJson<unknown>(storageKey).then((raw) => !stale && setIds(parseFavorites(raw)));
    return () => {
      stale = true;
    };
  }, [storageKey]);

  const toggle = useCallback(
    (id: number) => {
      if (FAVORITES_REQUIRE_LOGIN && !signedIn) {
        onLoginRequired();
        return;
      }
      if (!storageKey) return;
      setIds((current) => {
        const next = toggleFavorite(current, id);
        saveJson(storageKey, next);
        return next;
      });
    },
    [signedIn, onLoginRequired, storageKey],
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
