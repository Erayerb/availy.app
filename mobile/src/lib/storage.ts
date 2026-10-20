import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  user: 'availy.user',
  businessProfiles: 'availy.businessProfiles', // account id -> venue / plan kept on this phone (v2: server later)
  knownCustomers: 'availy.knownCustomers', // accounts used on this phone (business finds a customer by code)
  favorites: 'availy.favorites',
  campaigns: 'availy.campaigns', // business campaigns created on this phone
  localVenues: 'availy.localVenues', // venues added by business accounts on this phone
  settings: 'availy.settings',
  coupons: 'availy.coupons',
  campaignViews: 'availy.campaignViews',
  loyaltyPrograms: 'availy.loyaltyPrograms',
  stampCards: 'availy.stampCards',
  memberships: 'availy.memberships',
  watches: 'availy.watches',
  photos: 'availy.photos', // venueId -> one photo (data URI) shown on the home tile
  venueOverrides: 'availy.venueOverrides', // details edited by the business
  schedules: 'availy.schedules', // scheduled / recurring campaigns
  firedSchedules: 'availy.firedSchedules',
  feedback: 'availy.feedback',
  monitor: 'availy.monitor', // dead-hour alert / auto campaign timestamps
  support: 'availy.support', // bug reports and contact messages
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
