import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const workflow = JSON.parse(
  readFileSync(join(process.cwd(), 'n8n/evolution-whatsapp-zasso.json'), 'utf8'),
);
const normalizer = workflow.nodes.find((node) => node.name === 'Normalizar e Filtrar Evento');
const runNormalizer = new Function('$json', normalizer.parameters.jsCode);

function payload(overrides = {}) {
  return {
    body: {
      event: 'MESSAGES_UPSERT',
      instance: 'zasso-piloto',
      data: {
        key: {
          id: 'message-123',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        pushName: 'Ana',
        message: { conversation: 'Olá' },
      },
      ...overrides,
    },
  };
}

test('workflow n8n é JSON válido e contém os nodes essenciais', () => {
  assert.equal(workflow.active, false);
  for (const name of [
    'Evolution Webhook',
    'Normalizar e Filtrar Evento',
    'Consultar Chatbot Zasso',
    'Enviar pela Evolution',
  ]) {
    assert.ok(workflow.nodes.some((node) => node.name === name), `node ausente: ${name}`);
  }
});

test('normaliza mensagem privada recebida pela Evolution', () => {
  const [result] = runNormalizer(payload());
  assert.equal(result.json.number, '5511999999999');
  assert.equal(result.json.conversationId, 'whatsapp:zasso-piloto:5511999999999@s.whatsapp.net');
  assert.equal(result.json.messageId, 'message-123');
  assert.equal(result.json.text, 'Olá');
});

test('ignora mensagens próprias, grupos e eventos que não são mensagem', () => {
  const fromMe = payload();
  fromMe.body.data.key.fromMe = true;
  assert.deepEqual(runNormalizer(fromMe), []);

  const group = payload();
  group.body.data.key.remoteJid = '5511999999999-123@g.us';
  assert.deepEqual(runNormalizer(group), []);

  assert.deepEqual(runNormalizer(payload({ event: 'CONNECTION_UPDATE' })), []);
});

test('normaliza uma ligação recebida sem tratá-la como mensagem do lead', () => {
  const [result] = runNormalizer(payload({
    event: 'CALL',
    data: {
      id: 'call-123',
      from: '5511977777777@s.whatsapp.net',
      status: 'offer',
    },
  }));

  assert.equal(result.json.eventType, 'call');
  assert.equal(result.json.number, '5511977777777');
  assert.equal(result.json.messageId, 'call:call-123');
  assert.equal(result.json.text, '');
  assert.match(result.json.conversationId, /5511977777777@s\.whatsapp\.net$/);

  assert.deepEqual(runNormalizer(payload({
    event: 'CALL',
    data: { id: 'call-123', from: '5511977777777@s.whatsapp.net', status: 'terminate' },
  })), []);
});

test('usa remoteJidAlt para entrega quando a Evolution recebe um LID', () => {
  const lid = payload();
  lid.body.data.key.remoteJid = '123456789012345@lid';
  lid.body.data.key.remoteJidAlt = '5511888888888@s.whatsapp.net';
  const [result] = runNormalizer(lid);
  assert.equal(result.json.number, '5511888888888');
  assert.equal(result.json.conversationId, 'whatsapp:zasso-piloto:123456789012345@lid');
});
