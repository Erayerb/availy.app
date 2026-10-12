import { createContext, useCallback, useContext, type ReactNode } from 'react';

import { usePersistentState } from '../hooks/usePersistentState';
import { CLOSED_STYLE, levelStyle, type LevelLook } from '../lib/occupancy';
import { KEYS } from '../lib/storage';

export type Settings = {
  colorBlind: boolean; // colour-blind friendly palette + symbols
  watchNotifications: boolean; // phone notification when a watched venue empties
  deadHourAlerts: boolean; // business: tell me when my venue is in a dead hour
  autoCampaign: boolean; // business: send the ready-made campaign automatically in a dead hour
};

const DEFAULTS: Settings = { colorBlind: false, watchNotifications: true, deadHourAlerts: true, autoCampaign: false };

type SettingsValue = Settings & {
  update: (patch: Partial<Settings>) => void;
  // Colour, label and symbol for an occupancy level (grey "Kapalı" when closed)
  look: (level: string, open?: boolean) => LevelLook;
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

  return <SettingsContext.Provider value={{ ...settings, update, look }}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside SettingsProvider');
  return value;
}
