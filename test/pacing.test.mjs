import test from 'node:test';
import assert from 'node:assert/strict';
import { typingDelayFor } from '../src/pacing.mjs';

test('aplica pausa curta e limitada para simular digitação', () => {
  const shortDelay = typingDelayFor('Qual é sua região?');
  const longDelay = typingDelayFor('palavra '.repeat(300));
  assert.ok(shortDelay >= 900 && shortDelay <= 2200);
  assert.equal(longDelay, 2200);
  assert.ok(longDelay > shortDelay);
});
