import type { Level } from './occupancy';

export type Occupancy = {
  level: Level;
  ratio: number;
  updated_at: string;
};

export type Venue = {
  id: number;
  name: string;
  category: string;
  capacity: number;
  lat: number;
  lon: number;
  occupancy: Occupancy;
};

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export async function fetchVenues(bbox: string, signal?: AbortSignal): Promise<Venue[]> {
  if (!API_URL) {
    throw new Error('EXPO_PUBLIC_API_URL tanımlı değil (mobile/.env)');
  }
  const response = await fetch(`${API_URL}/v1/venues?bbox=${bbox}`, { signal });
  if (!response.ok) {
    throw new Error(`Sunucu hatası: ${response.status}`);
  }
  return response.json();
}
