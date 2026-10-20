import assert from 'node:assert/strict';
import { test } from 'node:test';

import { friendQrPayload, inviteFromQuery, inviteLink, inviteMessage, parseFriendCode } from '../src/lib/friends.ts';

test('friend QR codes, invite links and typed names all give the user name', () => {
  assert.equal(parseFriendCode(friendQrPayload('eray')), 'eray');
  assert.equal(parseFriendCode(inviteLink('eray_42')), 'eray_42');
  assert.equal(parseFriendCode(' @Eray '), 'eray');
  assert.equal(parseFriendCode('availy:customer:M-123456'), null);
  assert.equal(parseFriendCode('https://example.com'), null);
});

test('invite link and message', () => {
  assert.equal(inviteLink('eray'), 'https://erayerb.github.io/availy.app/v2/?invite=eray');
  assert.match(inviteMessage('eray'), /@eray https:\/\/erayerb\.github\.io\/availy\.app\/v2\/\?invite=eray$/);
  assert.equal(inviteFromQuery('?invite=eray'), 'eray');
  assert.equal(inviteFromQuery('?venue=Kafe'), null);
});
