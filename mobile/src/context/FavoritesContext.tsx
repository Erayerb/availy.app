import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { FAVORITES_REQUIRE_LOGIN, parseFavorites, toggleFavorite } from '../lib/favorites';
import { KEYS, loadJson, saveJson } from '../lib/storage';
import { notOnServer, userSyncApi } from '../lib/userSync';

type Favorites = {
  ids: number[];
  isFavorite: (id: number) => boolean;
  toggle: (id: number) => void;
};

const FavoritesContext = createContext<Favorites | null>(null);

type Props = {
  // Whose favorites: each account (and each guest) has its own list on the phone
  accountKey: string | null;
  token: string | null; // registered: the list lives on the server, the phone keeps a copy
  signedIn: boolean;
  onLoginRequired: () => void;
  children: ReactNode;
};

/** Favorite venue ids: on the server per account (so a new phone has them), with a copy on the phone. */
export function FavoritesProvider({ accountKey, token, signedIn, onLoginRequired, children }: Props) {
  const [ids, setIds] = useState<number[]>([]);
  // The older shared list (KEYS.favorites, before lists were per account) is left untouched
  const storageKey = accountKey ? `${KEYS.favorites}.${accountKey}` : null;

  useEffect(() => {
    setIds([]);
    if (!storageKey) return;
    let stale = false;
    (async () => {
      const local = parseFavorites(await loadJson<unknown>(storageKey));
      if (stale) return;
      setIds(local);
      if (!token) return;
      try {
        const server = await userSyncApi.favorites(token);
        // The phone's older list goes up once; after that the server decides (a removal elsewhere stays removed)
        const uploadedKey = `${storageKey}.uploaded`;
        const missing = (await loadJson<boolean>(uploadedKey)) ? [] : notOnServer(local, server);
        await Promise.all(missing.map((id) => userSyncApi.setFavorite(token, id, true).catch(() => {})));
        await saveJson(uploadedKey, true);
        const merged = [...server, ...missing];
        if (stale) return;
        setIds(merged);
        saveJson(storageKey, merged);
      } catch {
        // Offline: the phone's copy for now
      }
    })();
    return () => {
      stale = true;
    };
  }, [storageKey, token]);

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
        if (token) userSyncApi.setFavorite(token, id, next.includes(id)).catch(() => {});
        return next;
      });
    },
    [signedIn, onLoginRequired, storageKey, token],
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
