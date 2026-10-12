import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  user: 'availy.user',
  accounts: 'availy.accounts', // prototype accounts on this phone (password hashes only)
  favorites: 'availy.favorites',
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
