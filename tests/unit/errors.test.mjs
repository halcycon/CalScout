import test from 'node:test';
import assert from 'node:assert/strict';
import { UserError, userMessage } from '../../src/common/errors.mjs';

test('only deliberate application errors cross the UI boundary', () => {
  assert.equal(userMessage(new UserError('Unknown calendar')), 'Unknown calendar');
  assert.doesNotMatch(userMessage(new Error('Authorization: secret-token')), /secret-token/);
});
