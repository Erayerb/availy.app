import { createContext, useCallback, useContext, type ReactNode } from 'react';

import { usePersistentState } from '../hooks/usePersistentState';
import { isTentative, liveLevel, type Crowd } from '../lib/crowd';
import { CLOSED_STYLE, fadeColor, levelColorFor, levelStyle, STALE_STYLE, UNEXPLORED_STYLE, type LevelLook } from '../lib/occupancy';
import { isDarkScheme } from '../theme';
import { KEYS } from '../lib/storage';

export type Settings = {
  colorBlind: boolean; // colour-blind friendly palette + symbols
  watchNotifications: boolean; // phone notification when a watched venue empties
  premium: boolean; // B2C Premium (demo, no payment): no ads, unlimited watches
  // v2 notifications
  checkinSuggestions: boolean; // "Mado'dasın gibi, check-in yap?" after a few minutes near a venue
  // Sosyal bildirimler (phone notifications; the 🔔 list always has everything)
  friendNotifications: boolean; // friend requests
  friendAcceptedNotifications: boolean; // my requests accepted
  replyNotifications: boolean; // replies to my reviews
  checkinCommentNotifications: boolean; // comments on my check-ins
  checkinLikeNotifications: boolean; // likes on my check-ins
  // v2 privacy kept on the phone (the rest is on the server)
  privateByDefault: boolean; // the check-in screen starts with "Gizli check-in" on
  // Görünüm: follow the phone, or always light / dark / petrol / graphite (on trial)
  appearance: Appearance;
};

export type Appearance = 'system' | 'light' | 'dark' | 'petrol' | 'graphite';
const APPEARANCES: Appearance[] = ['system', 'light', 'dark', 'petrol', 'graphite'];

const DEFAULTS: Settings = {
  colorBlind: false,
  watchNotifications: true,
  premium: false,
  checkinSuggestions: true,
  friendNotifications: true,
  friendAcceptedNotifications: true,
  replyNotifications: true,
  checkinCommentNotifications: true,
  checkinLikeNotifications: true,
  privateByDefault: false,
  appearance: 'system',
};

type SettingsValue = Settings & {
  update: (patch: Partial<Settings>) => void;
  // Colour, label and symbol for an occupancy level (grey "Kapalı" when closed)
  look: (level: string, open?: boolean) => LevelLook;
  // v2: look of a venue from its check-ins (closed, fresh level, no recent data, never checked in)
  crowdLook: (venue: { open_now: boolean; crowd?: Crowd }) => LevelLook;
};

const SettingsContext = createContext<SettingsValue | null>(null);

const parse = (raw: unknown): Settings => {
  const settings = { ...DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) };
  // A theme that was removed (e.g. the trial "Koyu mavi") falls back to the phone's setting
  return APPEARANCES.includes(settings.appearance) ? settings : { ...settings, appearance: 'system' };
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = usePersistentState(KEYS.settings, DEFAULTS, parse);

  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), [setSettings]);
  const look = useCallback(
    (level: string, open = true): LevelLook => {
      if (!open) return { ...CLOSED_STYLE, glyph: settings.colorBlind ? CLOSED_STYLE.glyph : null };
      const base = levelStyle(level, settings.colorBlind);
      return { ...base, color: levelColorFor(base.color, isDarkScheme()) };
    },
    // The scheme is read when called, so the colours always follow Görünüm
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
