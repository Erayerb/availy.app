import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  user: 'availy.user',
  businessProfiles: 'availy.businessProfiles', // account id -> venue / plan kept on this phone (v2: server later)
  favorites: 'availy.favorites',
  settings: 'availy.settings',
  seenMoments: 'availy.seenMoments', // "Şu an burada" photos already opened (each is seen once)
  watches: 'availy.watches',
  notificationsSeen: 'availy.notificationsSeen', // account -> when the 🔔 list was last opened (v2)
  suggestionsAsked: 'availy.suggestionsAskedTimes', // venueId -> when "yakınındasın" asked in the last day
  lastLogin: 'availy.lastLogin', // "Beni hatırla": the user name / e-mail typed last
  tipsSeen: 'availy.tipsSeen', // the one-time tip bubbles already closed
  lastOpened: 'availy.lastOpened', // when the app was last in front: the "Sen yokken" card after a while
} as const;

export async function loadJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function saveJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Losing a local preference is not worth crashing the app over
  }
}

export async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Same as above
  }
}
