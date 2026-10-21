import { createContext, useCallback, useContext, type ReactNode } from 'react';

import { usePersistentState } from '../hooks/usePersistentState';
import { isTentative, liveLevel, type Crowd } from '../lib/crowd';
import { CLOSED_STYLE, fadeColor, levelStyle, STALE_STYLE, UNEXPLORED_STYLE, type LevelLook } from '../lib/occupancy';
import { KEYS } from '../lib/storage';

export type Settings = {
  colorBlind: boolean; // colour-blind friendly palette + symbols
  watchNotifications: boolean; // phone notification when a watched venue empties
  deadHourAlerts: boolean; // business: tell me when my venue is in a dead hour
  autoCampaign: boolean; // business: send the ready-made campaign automatically in a dead hour
  premium: boolean; // B2C Premium (demo, no payment): no ads, unlimited watches
  // v2 notifications
  checkinSuggestions: boolean; // "Mado'dasın gibi, check-in yap?" after a few minutes near a venue
  friendNotifications: boolean; // friend requests and accepted requests
  replyNotifications: boolean; // replies to my reviews
  // v2 privacy kept on the phone (the rest is on the server)
  privateByDefault: boolean; // the check-in screen starts with "Gizli check-in" on
};

const DEFAULTS: Settings = {
  colorBlind: false,
  watchNotifications: true,
  deadHourAlerts: true,
  autoCampaign: false,
  premium: false,
  checkinSuggestions: true,
  friendNotifications: true,
  replyNotifications: true,
  privateByDefault: false,
};

type SettingsValue = Settings & {
  update: (patch: Partial<Settings>) => void;
  // Colour, label and symbol for an occupancy level (grey "Kapalı" when closed)
  look: (level: string, open?: boolean) => LevelLook;
  // v2: look of a venue from its check-ins (closed, fresh level, no recent data, never checked in)
  crowdLook: (venue: { open_now: boolean; crowd?: Crowd }) => LevelLook;
};

const SettingsContext = createContext<SettingsValue | null>(null);

const parse = (raw: unknown): Settings => ({ ...DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = usePersistentState(KEYS.settings, DEFAULTS, parse);

  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), [setSettings]);
  const look = useCallback(
    (level: string, open = true): LevelLook =>
      open ? levelStyle(level, settings.colorBlind) : { ...CLOSED_STYLE, glyph: settings.colorBlind ? CLOSED_STYLE.glyph : null },
    [settings.colorBlind],
  );

  const crowdLook = useCallback(
    (venue: { open_now: boolean; crowd?: Crowd }): LevelLook => {
      if (!venue.open_now) return look('low', false);
      const level = liveLevel(venue);
      if (level) {
        const base = look(level);
        // One report only: faded until someone else confirms it
        return isTentative(venue)
          ? { ...base, color: fadeColor(base.color), label: `${venue.crowd!.reporters} kişiye göre ${base.label}` }
          : base;
      }
      return venue.crowd?.state === 'stale' ? STALE_STYLE : UNEXPLORED_STYLE;
    },
    [look],
  );

  return (
    <SettingsContext.Provider value={{ ...settings, update, look, crowdLook }}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside SettingsProvider');
  return value;
}
