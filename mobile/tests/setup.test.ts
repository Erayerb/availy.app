import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseNominatimAddress } from '../src/lib/reverseGeocode.ts';

test('Nominatim address: district from town, neighbourhood without "Mahallesi"', () => {
  assert.deepEqual(
    parseNominatimAddress({ quarter: 'Moda', suburb: 'Caferağa Mahallesi', town: 'Kadıköy', province: 'İstanbul' }),
    { district: 'Kadıköy', neighborhood: 'Moda' },
  );
  assert.deepEqual(
    parseNominatimAddress({ suburb: 'Cihannüma Mahallesi', town: 'Beşiktaş' }),
    { district: 'Beşiktaş', neighborhood: 'Cihannüma' },
  );
  assert.deepEqual(parseNominatimAddress({ road: 'Moda Caddesi', house_number: '12', suburb: 'Caferağa Mahallesi', town: 'Kadıköy' }), {
    district: 'Kadıköy',
    neighborhood: 'Caferağa',
    line: 'Moda Caddesi 12',
  });
  assert.equal(parseNominatimAddress({ province: 'İstanbul' }), null);
  assert.equal(parseNominatimAddress(undefined), null);
});

