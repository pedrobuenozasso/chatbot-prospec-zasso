import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decryptSecret,
  encryptSecret,
  hashPassword,
  randomTotpSecret,
  redactSensitiveText,
  verifyPassword,
  verifyTotp,
} from '../monitoring/security.mjs';
import { deterministicCandidates } from '../monitoring/analysis.mjs';

test('senhas administrativas usam hash forte e não ficam reversíveis', async () => {
  const encoded = await hashPassword('uma-senha-realmente-forte');
  assert.match(encoded, /^scrypt\$/);
  assert.equal(encoded.includes('uma-senha-realmente-forte'), false);
  assert.equal(await verifyPassword('uma-senha-realmente-forte', encoded), true);
  assert.equal(await verifyPassword('senha-incorreta', encoded), false);
});

test('segredo do autenticador é criptografado antes de persistir', () => {
  const secret = randomTotpSecret();
  const encrypted = encryptSecret(secret);
  assert.notEqual(encrypted, secret);
  assert.equal(decryptSecret(encrypted), secret);
  assert.equal(verifyTotp(secret, '123'), false);
});

test('anonimização remove telefone, e-mail e documentos antes da análise', () => {
  const result = redactSensitiveText('Pedro pedro@example.com +55 19 99999-9999 CPF 123.456.789-01 CNPJ 12.345.678/0001-99');
  assert.doesNotMatch(result, /pedro@example\.com|99999|123\.456|12\.345/);
  assert.match(result, /\[email removido\]|\[telefone removido\]|\[documento removido\]/);
});

test('análise determinística gera sugestão sem publicar FAQ', () => {
  const result = deterministicCandidates([{
    conversation_key: 'a'.repeat(64), language: 'pt-BR', stage: 'region',
    messages: [
      { direction: 'inbound', content: 'A máquina mata minhocas?' },
      { direction: 'outbound', content: 'Não encontrei uma confirmação suficiente para responder.' },
    ],
  }]);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].question, 'A máquina mata minhocas?');
  assert.equal(result.metrics.fallbackCount, 1);
});
