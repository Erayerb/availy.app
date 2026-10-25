/**
 * Venue features for the detail page: chosen by the business, or guessed from the type and purpose
 * tags. "Ücretsiz Wi-Fi" only when the data says so (OpenStreetMap: Wi-Fi without a fee).
 */
import type { Venue } from './api';

export type Amenity = { icon: string; label: string };

export type AmenityKey = 'wifi' | 'power' | 'quiet' | 'outdoor' | 'meeting' | 'music' | 'veggie';

export const ALL_AMENITIES: Record<AmenityKey, Amenity> = {
  wifi: { icon: '📶', label: 'Ücretsiz Wi-Fi' },
  power: { icon: '🔌', label: 'Priz' },
  quiet: { icon: '🤫', label: 'Sessiz alan' },
  outdoor: { icon: '🌿', label: 'Açık alan' },
  meeting: { icon: '👥', label: 'Toplantı odası' },
  music: { icon: '🎵', label: 'Müzik' },
  veggie: { icon: '🥗', label: 'Vejetaryen seçenek' },
};

const BY_CATEGORY: Record<string, AmenityKey[]> = {
  cafe: ['power', 'outdoor'],
  bar: ['music', 'outdoor'],
  restaurant: ['veggie', 'outdoor'],
  coworking: ['power', 'quiet', 'meeting'],
  library: ['power', 'quiet'],
};

export function amenitiesFor(venue: Pick<Venue, 'category' | 'tags' | 'amenity_keys'>): Amenity[] {
  // Features chosen by the business win over the defaults
  if (venue.amenity_keys) return venue.amenity_keys.map((k) => ALL_AMENITIES[k as AmenityKey]).filter(Boolean);
  const keys = new Set<AmenityKey>();
  if (venue.tags.includes('wifi')) keys.add('wifi');
  (BY_CATEGORY[venue.category] ?? []).forEach((k) => keys.add(k));
  if (venue.tags.includes('quiet')) keys.add('quiet');
  if (venue.tags.includes('coworking')) keys.add('power');
  return [...keys].map((k) => ALL_AMENITIES[k as AmenityKey]);
}
