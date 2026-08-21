import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'zasso-inactivity-'));
process.env.CONVERSATION_STATE_PATH = join(temporaryDirectory, 'conversations.json');

const { processInboundMessage } = await import('../src/agent.mjs');
const { getConversation } = await import('../src/conversation.mjs');
const { SUPPORTED_LANGUAGES, t } = await import('../src/i18n.mjs');
const { validateApiPayload } = await import('../src/server.mjs');
const { applyInactivitySupport } = await import('../n8n/apply-inactivity-support.mjs');

const migration = readFileSync(resolve('db/migrations/005_inactivity_reminders.sql'), 'utf8');
const databaseSource = readFileSync(resolve('src/database.mjs'), 'utf8');
const workflow = JSON.parse(readFileSync(resolve('n8n/inactivity-reminder.json'), 'utf8'));
const inboundWorkflow = applyInactivitySupport(JSON.parse(
  readFileSync(resolve('n8n/evolution-whatsapp-zasso.json'), 'utf8'),
));

test('migration cria fila aditiva, indexada e com somente um lembrete aberto por conversa', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS chatbot_inactivity_reminders/);
  assert.match(migration, /GENERATED ALWAYS AS IDENTITY PRIMARY KEY/);
  assert.match(migration, /WHERE status IN \('queued', 'sending', 'sent'\)/);
  assert.match(migration, /chatbot_inactivity_reminders_due_idx/);
  assert.doesNotMatch(migration, /\b(?:DROP|TRUNCATE|DELETE\s+FROM)\b/i);
});

test('fila reserva atomicamente, evita reenvio órfão e expira sem segunda mensagem', () => {
  assert.match(databaseSource, /FOR UPDATE SKIP LOCKED/);
  assert.match(databaseSource, /claim_timeout_manual_review/);
  assert.match(databaseSource, /status = 'expired',[\s\S]{0,100}last_error_code = 'no_response'/);
  assert.match(databaseSource, /status = 'inactive_lost'/);
});

test('workflow envia dois reply buttons oficiais e registra cada resultado', () => {
  assert.equal(workflow.active, false);
  assert.equal(workflow.settings.timezone, 'America/Sao_Paulo');
  const schedule = workflow.nodes.find((node) => node.name === 'A cada 5 minutos');
  const meta = workflow.nodes.find((node) => node.name === 'Enviar botões pela Meta');
  const result = workflow.nodes.find((node) => node.name === 'Registrar resultado');
  assert.equal(schedule.parameters.rule.interval[0].minutesInterval, 5);
  assert.match(meta.parameters.body, /interactive: \{ type: 'button'/);
  assert.match(meta.parameters.body, /continueId/);
  assert.match(meta.parameters.body, /closeId/);
  assert.equal(meta.credentials.httpHeaderAuth.name, 'Zasso Meta Cloud API');
  assert.match(result.parameters.url, /\/v1\/inactivity-reminders\/result$/);
  assert.doesNotMatch(JSON.stringify(workflow), /Bearer\s+[A-Za-z0-9]/);
});

test('workflow de entrada reconhece clique, encaminha o ID e preserva mensagens comuns', () => {
  const normalizer = inboundWorkflow.nodes.find((node) => node.name === 'Normalizar e Filtrar Evento');
  const chatbot = inboundWorkflow.nodes.find((node) => node.name === 'Consultar Chatbot Zasso');
  const runNormalizer = new Function('$json', normalizer.parameters.jsCode);
  const base = {
    body: {
      event: 'MESSAGES_UPSERT',
      instance: 'zasso-piloto',
      data: {
        key: { id: 'button-1', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: {
          buttonsResponseMessage: {
            selectedButtonId: 'zasso_inactivity:continue:42',
            selectedDisplayText: 'Sim, continuar',
          },
        },
      },
    },
  };
  const [clicked] = runNormalizer(base);
  assert.equal(clicked.json.eventType, 'interactive');
  assert.equal(clicked.json.interactionId, 'zasso_inactivity:continue:42');
  assert.equal(clicked.json.text, 'Sim, continuar');
  assert.match(chatbot.parameters.body, /interactionId: \$json\.interactionId/);

  base.body.data.key.id = 'text-1';
  base.body.data.message = { conversation: 'Olá' };
  const [ordinary] = runNormalizer(base);
  assert.equal(ordinary.json.eventType, 'message');
  assert.equal(ordinary.json.text, 'Olá');
  assert.equal(ordinary.json.interactionId, undefined);

  base.body.data.key.id = 'segment-1';
  base.body.data.message = {
    buttonsResponseMessage: {
      selectedButtonId: 'zasso_segment:agro',
      selectedDisplayText: '🌾 Agro',
    },
  };
  const [segment] = runNormalizer(base);
  assert.equal(segment.json.eventType, 'message');
  assert.equal(segment.json.text, 'Agro');
  assert.equal(segment.json.interactionId, undefined);
});

test('mensagem e botões estão localizados e respeitam o limite da Meta', () => {
  for (const language of SUPPORTED_LANGUAGES) {
    assert.ok(t(language, 'inactivityPrompt').length >= 10);
    assert.ok(t(language, 'inactivityContinueButton').length <= 20);
    assert.ok(t(language, 'inactivityCloseButton').length <= 20);
    assert.ok(t(language, 'inactivityClosed').length >= 40);
    assert.ok(t(language, 'segmentAgroButton').length <= 20);
    assert.ok(t(language, 'segmentUrbanButton').length <= 20);
  }
});

test('API aceita somente interação identificada e mantém o contrato seguro', () => {
  const payload = validateApiPayload({
    channel: 'whatsapp',
    eventType: 'interactive',
    conversationId: 'whatsapp:meta:5511999999999',
    messageId: 'wamid.button.1',
    interactionId: 'zasso_inactivity:continue:42',
    text: 'Sim, continuar',
    recipientNumber: '5511999999999',
  });
  assert.equal(payload.eventType, 'interactive');
  assert.equal(payload.interactionId, 'zasso_inactivity:continue:42');
  assert.throws(() => validateApiPayload({
    ...payload,
    interactionId: '',
  }), /missing_required_fields/);
});

test('Sim retoma a pergunta pendente e Não encerra sem novos disparos', async () => {
  const continueConversation = 'whatsapp:inactivity:continue';
  await processInboundMessage({
    conversationId: continueConversation,
    messageId: 'continue-1',
    text: 'Olá',
    firstName: 'Ana',
  });
  const continued = await processInboundMessage({
    conversationId: continueConversation,
    messageId: 'continue-button',
    text: 'Sim, continuar',
    eventType: 'interactive',
    interactionId: 'zasso_inactivity:continue:42',
    inactivityDecisionAccepted: true,
  });
  assert.equal(continued.inactivityDecision, 'continue');
  assert.equal(continued.stage, 'segment');
  assert.match(continued.messages.join(' '), /vamos continuar/i);
  assert.match(continued.messages.join(' '), /segmento deseja receber informações/i);

  const closeConversation = 'whatsapp:inactivity:close';
  await processInboundMessage({
    conversationId: closeConversation,
    messageId: 'close-1',
    text: 'Olá',
    firstName: 'Carlos',
  });
  const closed = await processInboundMessage({
    conversationId: closeConversation,
    messageId: 'close-button',
    text: 'Não, encerrar',
    eventType: 'interactive',
    interactionId: 'zasso_inactivity:close:43',
    inactivityDecisionAccepted: true,
  });
  assert.equal(closed.inactivityDecision, 'close');
  assert.equal(closed.stage, 'closed');
  assert.equal(getConversation(closeConversation).closureReason, 'lead_declined_inactivity');
  assert.match(closed.messages[0], /não enviarei novas mensagens/i);
});

test('botão antigo é idempotente e não altera a conversa', async () => {
  const conversationId = 'whatsapp:inactivity:stale';
  await processInboundMessage({ conversationId, messageId: 'stale-1', text: 'Olá' });
  const stale = await processInboundMessage({
    conversationId,
    messageId: 'stale-button',
    text: 'Não, encerrar',
    eventType: 'interactive',
    interactionId: 'zasso_inactivity:close:999',
    inactivityDecisionAccepted: false,
  });
  assert.equal(stale.inactivityDecision, 'stale');
  assert.deepEqual(stale.messages, []);
  assert.equal(stale.stage, 'segment');
});
