import assert from 'node:assert/strict';
import { test } from 'node:test';

import { doorPosterHtml, qrSvg } from '../src/lib/doorPoster.ts';
import { venueDoorLink, venueIdFromDoorLink } from '../src/lib/share.ts';

test('the door link names its venue, and only such a link does', () => {
  assert.equal(venueIdFromDoorLink(venueDoorLink(9192)), 9192);
  assert.equal(venueIdFromDoorLink('?kapi=7'), 7);
  assert.equal(venueIdFromDoorLink('availy:customer:M-1'), null);
  assert.equal(venueIdFromDoorLink('https://example.test/?venue=Mado'), null);
});

test('the poster has the code and a safe venue name', () => {
  assert.match(qrSvg('https://a.test/?kapi=1'), /^<svg .*<path d="M/);
  const html = doorPosterHtml('Kahve <b>&</b> Co', 'https://a.test/?kapi=1');
  assert.ok(html.includes('Kahve &lt;b&gt;&amp;&lt;/b&gt; Co') && !html.includes('<b>&'));
});
