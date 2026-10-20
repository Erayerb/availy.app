import { createContext, useCallback, useContext, type ReactNode } from 'react';

import { usePersistentState } from '../hooks/usePersistentState';
import { liveLevel, type Crowd } from '../lib/crowd';
import { CLOSED_STYLE, levelStyle, STALE_STYLE, UNEXPLORED_STYLE, type LevelLook } from '../lib/occupancy';
import { KEYS } from '../lib/storage';

export type Settings = {
  colorBlind: boolean; // colour-blind friendly palette + symbols
  watchNotifications: boolean; // phone notification when a watched venue empties
  deadHourAlerts: boolean; // business: tell me when my venue is in a dead hour
  autoCampaign: boolean; // business: send the ready-made campaign automatically in a dead hour
  premium: boolean; // B2C Premium (demo, no payment): no ads, unlimited watches
};

const DEFAULTS: Settings = { colorBlind: false, watchNotifications: true, deadHourAlerts: true, autoCampaign: false, premium: false };

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
      if (level) return look(level);
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
