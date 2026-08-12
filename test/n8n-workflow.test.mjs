import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const workflow = JSON.parse(
  readFileSync(join(process.cwd(), 'n8n/evolution-whatsapp-zasso.json'), 'utf8'),
);
const normalizer = workflow.nodes.find((node) => node.name === 'Normalizar e Filtrar Evento');
const runNormalizer = new Function('$json', normalizer.parameters.jsCode);
const preparer = workflow.nodes.find((node) => node.name === 'Preparar Respostas');
const runPreparer = new Function('$', '$json', preparer.parameters.jsCode);

function prepareMessages(messages, language = 'pt-BR') {
  const inbound = {
    instance: 'zasso-oficial',
    number: '5519999999999',
    language: 'pt-BR',
  };
  const nodeLookup = (name) => {
    assert.equal(name, 'Normalizar e Filtrar Evento');
    return { first: () => ({ json: inbound }) };
  };
  return runPreparer(nodeLookup, { messages, language });
}

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
    'É CTA Comercial?',
    'Enviar CTA pela Meta',
  ]) {
    assert.ok(workflow.nodes.some((node) => node.name === name), `node ausente: ${name}`);
  }
});

test('converte somente o link comercial aprovado em botão CTA oficial', () => {
  const commercialUrl = 'https://wa.me/5511967702212?text=Resumo%20seguro';
  const [result] = prepareMessages([
    'Toque no link abaixo para continuar:\n\n' + commercialUrl,
  ]);

  assert.equal(result.json.messageType, 'commercial_cta');
  assert.equal(result.json.ctaLabel, 'Falar com a equipe');
  assert.equal(result.json.ctaUrl, commercialUrl);
  assert.doesNotMatch(result.json.text, /wa\.me|https?:\/\//i);
});

test('não transforma link externo ou outro número em CTA comercial', () => {
  for (const message of [
    'Veja https://example.com/alguma-coisa',
    'https://wa.me/5511999999999?text=Outro',
    'https://wa.me/5511967702212',
  ]) {
    const [result] = prepareMessages([message]);
    assert.equal(result.json.messageType, 'text');
    assert.equal(result.json.text, message);
    assert.equal(result.json.ctaUrl, undefined);
  }
});

test('localiza texto e rótulo do CTA em todos os idiomas suportados', () => {
  const link = 'https://wa.me/5511967702212?text=Resumo';
  const expectations = new Map([
    ['pt-BR', 'Falar com a equipe'],
    ['en', 'Talk to our team'],
    ['de', 'Zum Vertrieb'],
    ['fr', 'Contacter l’équipe'],
    ['es', 'Hablar con el equipo'],
  ]);

  for (const [language, label] of expectations) {
    const [result] = prepareMessages([link], language);
    assert.equal(result.json.messageType, 'commercial_cta');
    assert.equal(result.json.ctaLabel, label);
    assert.ok(label.length <= 20, 'rótulo excede limite da Meta: ' + label);
    assert.ok(result.json.text.length > 20);
  }
});

test('node da Meta usa credencial referenciada e payload cta_url sem token embutido', () => {
  const node = workflow.nodes.find((candidate) => candidate.name === 'Enviar CTA pela Meta');
  assert.equal(node.credentials.httpHeaderAuth.name, 'Zasso Meta Cloud API');
  assert.match(node.parameters.url, /^https:\/\/graph\.facebook\.com\/v25\.0\/\d+\/messages$/);
  assert.match(node.parameters.body, /type: 'cta_url'/);
  assert.match(node.parameters.body, /display_text: \$json\.ctaLabel/);
  assert.doesNotMatch(JSON.stringify(node.parameters), /EA[A-Za-z0-9]{30,}/);
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
