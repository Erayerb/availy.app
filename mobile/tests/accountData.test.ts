import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rekey } from '../src/lib/accountData.ts';

test("a new e-mail takes over the account's items; other people's stay", () => {
  const items = [
    { id: 1, userKey: 'eski@example.com' },
    { id: 2, userKey: 'baska@example.com' },
  ];
  assert.deepEqual(rekey(items, 'eski@example.com', 'yeni@example.com'), [
    { id: 1, userKey: 'yeni@example.com' },
    { id: 2, userKey: 'baska@example.com' },
  ]);
});
