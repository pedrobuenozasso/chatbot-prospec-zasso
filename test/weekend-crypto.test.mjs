import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptWeekendRecipient,
  encryptWeekendRecipient,
  validateWeekendEncryptionKey,
} from '../src/weekend-crypto.mjs';

const key = 'f'.repeat(64);

test('criptografa o telefone com nonce aleatório e autenticação', () => {
  const first = encryptWeekendRecipient('5511999999999', key);
  const second = encryptWeekendRecipient('5511999999999', key);
  assert.notEqual(first, second);
  assert.equal(decryptWeekendRecipient(first, key), '5511999999999');
  assert.equal(decryptWeekendRecipient(second, key), '5511999999999');
  assert.doesNotMatch(first, /5511999999999/);
});

test('rejeita chave, telefone e ciphertext inválidos', () => {
  assert.equal(validateWeekendEncryptionKey(key), true);
  assert.throws(() => validateWeekendEncryptionKey('curta'), /32 bytes/);
  assert.throws(() => encryptWeekendRecipient('123', key), /inválido/);
  assert.throws(() => decryptWeekendRecipient('v1.incompleto', key), /inválido/);
});
