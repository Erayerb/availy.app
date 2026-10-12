/**
 * TypeScript copy of the backend's DummyOccupancyProvider, used by the static
 * (serverless) web build. Same idea and thresholds; the random numbers differ.
 */
import type { Level } from './occupancy';

export const BUCKET_SECONDS = 300;
const LOW_MAX = 0.4;
const MEDIUM_MAX = 0.75;
const NOISE = 0.2;
// Istanbul has been UTC+3 all year since 2016
const ISTANBUL_UTC_OFFSET_HOURS = 3;

// Typical busyness by local hour (0-23): quiet nights, lunch and evening peaks
const HOURLY_BASE = [
  0.05, 0.05, 0.05, 0.05, 0.05, 0.05, // 00-05
  0.1, 0.2, 0.3, 0.35, 0.4, 0.5, // 06-11
  0.75, 0.8, 0.6, 0.5, 0.5, 0.6, // 12-17
  0.75, 0.85, 0.8, 0.6, 0.4, 0.2, // 18-23
];

export function classify(ratio: number): Level {
  if (ratio < LOW_MAX) return 'low';
  if (ratio <= MEDIUM_MAX) return 'medium';
  return 'high';
}

/** Deterministic number in [0, 1) for a string seed (FNV-1a + mulberry32 step). */
function seededRandom(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let t = (h + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function dummyOccupancy(venueId: number, at: Date, popularity = 1) {
  const bucket = Math.floor(at.getTime() / 1000 / BUCKET_SECONDS);
  const localHour = (at.getUTCHours() + ISTANBUL_UTC_OFFSET_HOURS) % 24;
  const noise = (seededRandom(`${venueId}:${bucket}`) * 2 - 1) * NOISE;
  const raw = (HOURLY_BASE[localHour] + noise) * popularity;
  const ratio = Math.round(Math.min(Math.max(raw, 0), 1) * 100) / 100;
  return {
    level: classify(ratio),
    ratio,
    updated_at: new Date(bucket * BUCKET_SECONDS * 1000).toISOString(),
  };
}

export function averageOccupancy(ratios: number[]) {
  const ratio = Math.round((ratios.reduce((sum, r) => sum + r, 0) / ratios.length) * 100) / 100;
  return { level: classify(ratio), ratio };
}
