import assert from 'node:assert/strict';
import { test } from 'node:test';

import { directionsUrl, shortLocation } from '../src/lib/location.ts';

test('shortLocation joins neighborhood and district', () => {
  assert.equal(shortLocation('Moda', 'Kadıköy'), 'Moda, Kadıköy');
  assert.equal(shortLocation('', 'Kadıköy'), 'Kadıköy');
});

test('directionsUrl uses Apple Maps on iOS', () => {
  assert.equal(directionsUrl('ios', 40.984, 29.026), 'http://maps.apple.com/?daddr=40.984,29.026');
});

test('directionsUrl uses Google Maps on Android', () => {
  assert.equal(
    directionsUrl('android', 40.984, 29.026),
    'https://www.google.com/maps/dir/?api=1&destination=40.984,29.026',
  );
});
