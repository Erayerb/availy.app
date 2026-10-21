/** Venue features for the detail page (demo: derived from type and purpose tags). */
import type { Venue } from './api';

export type Amenity = { icon: string; label: string };

export type AmenityKey = 'wifi' | 'power' | 'quiet' | 'outdoor' | 'meeting' | 'music' | 'veggie';

export const ALL_AMENITIES: Record<AmenityKey, Amenity> = {
  wifi: { icon: '📶', label: 'Wi-Fi' },
  power: { icon: '🔌', label: 'Priz' },
  quiet: { icon: '🤫', label: 'Sessiz alan' },
  outdoor: { icon: '🌿', label: 'Açık alan' },
  meeting: { icon: '👥', label: 'Toplantı odası' },
  music: { icon: '🎵', label: 'Müzik' },
  veggie: { icon: '🥗', label: 'Vejetaryen seçenek' },
};

const BY_CATEGORY: Record<string, AmenityKey[]> = {
  cafe: ['wifi', 'power', 'outdoor'],
  bar: ['music', 'outdoor'],
  restaurant: ['veggie', 'outdoor'],
  coworking: ['wifi', 'power', 'quiet', 'meeting'],
  library: ['wifi', 'power', 'quiet'],
  park: ['outdoor'],
};

export function amenitiesFor(venue: Pick<Venue, 'category' | 'tags' | 'amenity_keys'>): Amenity[] {
  // Features chosen by the business win over the defaults
  if (venue.amenity_keys) return venue.amenity_keys.map((k) => ALL_AMENITIES[k as AmenityKey]).filter(Boolean);
  const keys = new Set<AmenityKey>(BY_CATEGORY[venue.category] ?? ['wifi']);
  if (venue.tags.includes('quiet')) keys.add('quiet');
  if (venue.tags.includes('coworking')) keys.add('power').add('wifi');
  return [...keys].map((k) => ALL_AMENITIES[k as AmenityKey]);
}
