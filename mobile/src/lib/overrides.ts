/**
 * Venue details a business edits (name, description, capacity, hours, purposes,
 * features). Prototype: kept on this phone and applied on top of server data.
 */
import type { Venue } from './api';
import { hoursLabel, isOpenAtHour, istanbulHour, opensAt } from './hours.ts';

export type VenueOverride = {
  name?: string;
  description?: string;
  capacity?: number;
  hours?: [number, number]; // opening, closing hour (closing <= opening: after midnight)
  tags?: string[];
  amenities?: string[]; // keys from amenities.ts
};

export function validateOverride(o: VenueOverride): string | null {
  if (o.capacity !== undefined && (!Number.isInteger(o.capacity) || o.capacity < 1 || o.capacity > 2000))
    return 'Kapasite 1 ile 2000 arasında olmalı.';
  if (o.hours) {
    const [open, close] = o.hours;
    if (![open, close].every((h) => Number.isInteger(h) && h >= 0 && h <= 24)) return 'Saatler 0 ile 24 arasında olmalı.';
    if (open === close) return 'Açılış ve kapanış saati aynı olamaz.';
  }
  if (o.name !== undefined && (o.name.trim().length < 2 || o.name.trim().length > 60))
    return 'İşletme adı 2 ile 60 karakter arasında olmalı.';
  if (o.tags && o.tags.length === 0) return 'En az bir amaç seç.';
  if (o.description && o.description.length > 200) return 'Açıklama en fazla 200 karakter olabilir.';
  return null;
}

export function applyOverride(venue: Venue, override: VenueOverride | undefined, now = new Date()): Venue {
  if (!override) return venue;
  const next: Venue = { ...venue };
  if (override.name) next.name = override.name.trim();
  if (override.description !== undefined) next.description = override.description;
  if (override.capacity !== undefined) next.capacity = override.capacity;
  if (override.tags) next.tags = override.tags;
  if (override.amenities) next.amenity_keys = override.amenities;
  if (override.hours) {
    next.hours = hoursLabel(override.hours);
    next.opens_at = opensAt(override.hours);
    next.open_now = isOpenAtHour(override.hours, istanbulHour(now));
  }
  return next;
}
