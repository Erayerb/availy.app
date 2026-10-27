import assert from 'node:assert/strict';
import { test } from 'node:test';

import { listCodeFromQuery, listLink, listShareMessage } from '../src/lib/lists.ts';

test('list links: made and read back', () => {
  assert.match(listLink('ACDE3479'), /\?list=ACDE3479$/);
  assert.match(listShareMessage('Ders yerleri', 'ACDE3479'), /"Ders yerleri" listeme bak: .*\?list=ACDE3479/);
  assert.equal(listCodeFromQuery('?list=acde3479'), 'ACDE3479');
  assert.equal(listCodeFromQuery('?invite=eray'), null);
  assert.equal(listCodeFromQuery('?list=<script>'), null);
});
