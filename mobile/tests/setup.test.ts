import assert from 'node:assert/strict';
import { test } from 'node:test';

import { districtCenter, nearestVenueAddress, parseNominatimAddress } from '../src/lib/reverseGeocode.ts';

test('Nominatim address: district from town, neighbourhood without "Mahallesi"', () => {
  assert.deepEqual(
    parseNominatimAddress({ quarter: 'Moda', suburb: 'Caferağa Mahallesi', town: 'Kadıköy', province: 'İstanbul' }),
    { district: 'Kadıköy', neighborhood: 'Moda' },
  );
  assert.deepEqual(
    parseNominatimAddress({ suburb: 'Cihannüma Mahallesi', town: 'Beşiktaş' }),
    { district: 'Beşiktaş', neighborhood: 'Cihannüma' },
  );
  assert.equal(parseNominatimAddress({ province: 'İstanbul' }), null);
  assert.equal(parseNominatimAddress(undefined), null);
});

test('fallback: nearest venue gives the district', () => {
  const venues = [
    { lat: 41.043, lon: 29.006, district: 'Beşiktaş', neighborhood: 'Sinanpaşa' },
    { lat: 40.984, lon: 29.026, district: 'Kadıköy', neighborhood: 'Moda' },
  ];
  assert.deepEqual(nearestVenueAddress({ lat: 40.99, lon: 29.03 }, venues), { district: 'Kadıköy', neighborhood: 'Moda' });
  assert.equal(nearestVenueAddress({ lat: 0, lon: 0 }, []), null);
});

test('district centre fallback for an address that is not found', () => {
  const venues = [
    { lat: 41.0, lon: 29.0, district: 'Kadıköy' },
    { lat: 41.2, lon: 29.2, district: 'Kadıköy' },
    { lat: 40.0, lon: 28.0, district: 'Şişli' },
  ];
  assert.deepEqual(districtCenter('Kadıköy', venues), { lat: 41.1, lon: 29.1 });
  assert.equal(districtCenter('Adalar', venues), null);
});
