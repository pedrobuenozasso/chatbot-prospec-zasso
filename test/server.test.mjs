import test from 'node:test';
import assert from 'node:assert/strict';
import { validateApiPayload } from '../src/server.mjs';

test('aceita o canal web sem alterar o contrato de mensagens', () => {
  const payload = validateApiPayload({
    conversationId: 'web:9f9554cb-408e-49ef-b568-c34addbccb20',
    messageId: '5f8806ef-92e4-4ab7-8efc-16aff5456020',
    text: 'Como funciona a capina elétrica?',
    language: 'pt-BR',
    channel: 'web',
  });

  assert.equal(payload.channel, 'web');
  assert.equal(payload.eventType, 'message');
});

test('continua recusando canais não autorizados', () => {
  assert.throws(
    () => validateApiPayload({
      conversationId: 'visitor',
      messageId: 'message',
      text: 'teste',
      channel: 'browser-direct',
    }),
    /unsupported_channel/,
  );
});

test('aceita somente telefone internacional válido para agendamento', () => {
  const payload = validateApiPayload({
    conversationId: 'whatsapp:test:recipient',
    messageId: 'message-recipient',
    text: 'Olá',
    channel: 'whatsapp',
    recipientNumber: '+55 (11) 99999-9999',
  });
  assert.equal(payload.recipientNumber, '5511999999999');
  assert.throws(() => validateApiPayload({
    conversationId: 'whatsapp:test:recipient',
    messageId: 'message-recipient-2',
    text: 'Olá',
    channel: 'whatsapp',
    recipientNumber: '123',
  }), /invalid_recipient_number/);
});
