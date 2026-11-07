/* SPDX-License-Identifier: MPL-2.0 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarURL, subscriptionKey } from '../../src/common/urls.mjs';
test('equivalent URLs match without destroying encoded separators or path case', () => {
  assert.equal(calendarURL('https://EXAMPLE.com:443/a/%7ealice'), 'https://example.com/a/~alice/');
  assert.equal(calendarURL('https://example.com/a%2fb/'), 'https://example.com/a%2Fb/');
  assert.notEqual(calendarURL('https://example.com/A'), calendarURL('https://example.com/a'));
});
test('credentials, query tokens, fragments and remote plaintext are rejected', () => {
  for (const url of [
    'http://example.com/a',
    'https://alice:secret@example.com/a',
    'https://example.com/a?token=x',
    'https://example.com/a#x',
    'file:///a',
  ]) {
    assert.throws(() => calendarURL(url, true));
  }
});
test('localhost exception must be explicit and exact', () => {
  assert.throws(() => calendarURL('http://localhost:8000/a'));
  assert.equal(calendarURL('http://127.0.0.1:8000/a', true), 'http://127.0.0.1:8000/a/');
  assert.throws(() => calendarURL('http://localhost.evil.example/a', true));
});
test('authentication usernames define distinct subscription boundaries', () => {
  assert.notEqual(
    subscriptionKey('https://example.com/a', 'alice'),
    subscriptionKey('https://example.com/a', 'bob'),
  );
});
