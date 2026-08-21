import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'zasso-reviewed-regression-'));
process.env.CONVERSATION_STATE_PATH = join(temporaryDirectory, 'conversations.json');
process.env.HANDOFF_OUTBOX_PATH = join(temporaryDirectory, 'handoffs.jsonl');
process.env.WEEKEND_HANDOFF_ENABLED = 'false';

const { processInboundMessage: processInboundMessageAtRuntime } = await import('../src/agent.mjs');
const { advanceQualification, getConversation, newConversation, restoreConversation, STAGES } = await import('../src/conversation.mjs');
const { parseAreaAnswer } = await import('../src/area.mjs');
const { qualifiedLeadSummary } = await import('../src/handoff.mjs');
const { localQualificationAssessment } = await import('../src/rag.mjs');
const normalBusinessHours = new Date('2026-08-18T12:00:00-03:00');
const processInboundMessage = (payload) => processInboundMessageAtRuntime({ now: normalBusinessHours, ...payload });

test.after(() => rmSync(temporaryDirectory, { recursive: true, force: true }));

function urbanProfileState(language = 'pt-BR') {
  const state = newConversation({ language });
  state.stage = STAGES.URBAN_PROFILE;
  state.qualification.segment = 'urban';
  state.qualification.region = 'Europa';
  return state;
}

test('reconhece órgãos públicos locais em Portugal, Espanha, França e Alemanha', () => {
  for (const answer of [
    'Junta de freguesia',
    'Câmara municipal',
    'Ayuntamiento',
    'Municipalité',
    'Gemeinde',
  ]) {
    const state = urbanProfileState();
    const result = advanceQualification(state, answer);
    assert.equal(result.completed, true, answer);
    assert.equal(state.qualification.urbanProfile, 'prefeitura', answer);
  }
});

test('pedido explícito de uma pessoa encerra a repetição e gera handoff parcial em cinco idiomas', async () => {
  const requests = [
    ['pt-BR', 'Quero falar com alguém do comercial'],
    ['en-US', 'Please connect me with a person'],
    ['de-DE', 'Ich möchte mit einem Mitarbeiter sprechen'],
    ['fr-FR', 'Je voudrais parler à une personne'],
    ['es-ES', 'Pásame cuando puedas con una persona'],
  ];
  for (const [index, [language, text]] of requests.entries()) {
    const conversationId = `review:human:${index}`;
    const state = newConversation({ language });
    state.stage = STAGES.AGRO_CROP;
    state.qualification.segment = 'agro';
    state.qualification.region = 'Europa';
    restoreConversation(conversationId, state);
    const result = await processInboundMessage({
      conversationId,
      messageId: `human-${index}`,
      text,
      language,
      channel: 'whatsapp',
      now: new Date('2026-08-18T12:00:00-03:00'),
    });
    assert.equal(result.stage, STAGES.COMPLETED, text);
    assert.equal(result.partialHandoff, true, text);
    assert.match(result.messages.join('\n'), /wa\.me\//i, text);
  }
});

test('normaliza erros comuns de unidade e recusa uma área isolada implausível', () => {
  assert.equal(parseAreaAnswer('420 hc aproximadamente', 'es-ES')?.areaHectares, 420);
  assert.equal(parseAreaAnswer('100 areas, una hectaria', 'es-ES')?.areaHectares, 1);
  assert.equal(parseAreaAnswer('200.000 metros quadrados', 'pt-BR')?.areaHectares, 20);
  assert.equal(parseAreaAnswer('Em média 500 hectares', 'pt-BR')?.areaHectares, 500);
  assert.equal(parseAreaAnswer('420000', 'es-ES'), null);
  assert.equal(localQualificationAssessment('agro_area', '420000').kind, 'invalid');
});

test('uma dúvida comercial durante a triagem é respondida sem perder o campo pendente', async () => {
  const conversationId = 'review:commercial-question';
  const state = newConversation({ language: 'pt-BR' });
  state.stage = STAGES.URBAN_PROFILE;
  state.qualification.segment = 'urban';
  state.qualification.region = 'Campinas/SP';
  restoreConversation(conversationId, state);

  const result = await processInboundMessage({
    conversationId,
    messageId: 'commercial-question-1',
    text: 'Qual o valor?',
    language: 'pt-BR',
  });
  assert.equal(result.stage, STAGES.URBAN_PROFILE);
  assert.equal(result.messages.length, 2);
  assert.match(result.messages[0], /investimento|aplica[cç][aã]o/i);
  assert.match(result.messages[1], /prefeitura|prestador/i);
  const saved = getConversation(conversationId);
  assert.match([saved.initialInterest, ...saved.interests].join(' '), /valor/i);
});

test('terceira resposta inválida interrompe o loop e encaminha o contexto parcial', async () => {
  const conversationId = 'review:anti-loop';
  const state = newConversation({ language: 'pt-BR' });
  state.stage = STAGES.SEGMENT;
  restoreConversation(conversationId, state);

  const first = await processInboundMessage({ conversationId, messageId: 'loop-1', text: 'ambos' });
  assert.equal(first.stage, STAGES.SEGMENT);
  const second = await processInboundMessage({ conversationId, messageId: 'loop-2', text: 'de novo a mesma pergunta' });
  assert.match(second.messages.join(' '), /desculpe|reform/i);
  const third = await processInboundMessage({ conversationId, messageId: 'loop-3', text: 'as duas' });
  assert.equal(third.partialHandoff, true);
  assert.equal(third.stage, STAGES.COMPLETED);
  assert.match(third.messages.join('\n'), /wa\.me\//i);
});

test('mensagem genérica de campanha recebe contexto útil antes da pergunta de segmento', async () => {
  const result = await processInboundMessage({
    conversationId: 'review:generic-campaign',
    messageId: 'generic-1',
    text: 'Olá! Posso ter mais informações sobre isso?',
    language: 'pt-BR',
  });
  assert.equal(result.stage, STAGES.SEGMENT);
  assert.match(result.messages[0], /pioneiros em Capina Elétrica/i);
  assert.match(result.messages[1], /sobre qual segmento/i);
});

test('região portuguesa muda o vocabulário para PT-PT sem alterar o fluxo', () => {
  const state = newConversation({ language: 'pt-BR' });
  state.stage = STAGES.REGION;
  state.qualification.segment = 'urban';
  const result = advanceQualification(state, 'Portugal', 'pt-BR');
  assert.equal(state.language, 'pt-PT');
  assert.match(result.nextQuestion, /c[aâ]mara municipal|junta de freguesia/i);
});

test('porte urbano espontâneo é preservado no resumo sem virar pergunta obrigatória', async () => {
  const conversationId = 'review:urban-scale';
  const state = urbanProfileState('pt-BR');
  state.qualification.region = 'Maringá/PR';
  restoreConversation(conversationId, state);

  const scale = await processInboundMessage({
    conversationId,
    messageId: 'scale-1',
    text: 'Temos 100 alqueires ou 2 mil lotes',
  });
  assert.equal(scale.stage, STAGES.URBAN_PROFILE);

  const completed = await processInboundMessage({
    conversationId,
    messageId: 'scale-2',
    text: 'Empresa loteadora',
    now: new Date('2026-08-18T12:00:00-03:00'),
  });
  assert.equal(completed.qualified, true);
  const summary = qualifiedLeadSummary(getConversation(conversationId));
  assert.match(summary.urbanScale, /100 alqueires|2 mil lotes/i);
});

test('gate final impede handoff com área sem unidade e baixa confiança', async () => {
  const conversationId = 'review:confidence-gate';
  const state = newConversation({ language: 'es-ES' });
  state.stage = STAGES.AGRO_AREA;
  state.qualification.segment = 'agro';
  state.qualification.region = 'Valencia';
  state.qualification.crop = 'Cítricos';
  restoreConversation(conversationId, state);

  const result = await processInboundMessage({
    conversationId,
    messageId: 'confidence-1',
    text: '420000',
    language: 'es-ES',
    now: new Date('2026-08-18T12:00:00-03:00'),
  });
  assert.equal(result.stage, STAGES.AGRO_AREA);
  assert.equal(result.qualified, undefined);
  assert.doesNotMatch(result.messages.join('\n'), /wa\.me\//i);
});

test('sexta-feira após 17h bloqueia CTA mesmo com o antigo piloto de domingo desligado', async () => {
  const conversationId = 'review:friday-hard-block';
  const state = newConversation({ language: 'es-ES' });
  state.stage = STAGES.AGRO_AREA;
  state.qualification.segment = 'agro';
  state.qualification.region = 'Galicia';
  state.qualification.crop = 'Cítricos';
  restoreConversation(conversationId, state);

  const result = await processInboundMessage({
    conversationId,
    messageId: 'friday-1',
    text: '420 hc aproximadamente',
    language: 'es-ES',
    channel: 'whatsapp',
    now: new Date('2026-08-14T17:00:00-03:00'),
  });
  assert.equal(result.qualified, true);
  assert.equal(result.handoffStatus, 'weekend_deferred');
  assert.doesNotMatch(result.messages.join('\n'), /wa\.me\//i);
});

test('sexta-feira antes das 17h mantém o encaminhamento comercial normal', async () => {
  const conversationId = 'review:friday-before-cutoff';
  const state = newConversation({ language: 'pt-BR' });
  state.stage = STAGES.AGRO_AREA;
  state.qualification.segment = 'agro';
  state.qualification.region = 'Campinas/SP';
  state.qualification.crop = 'Café';
  restoreConversation(conversationId, state);

  const result = await processInboundMessage({
    conversationId,
    messageId: 'friday-before-1',
    text: '20 hectares',
    language: 'pt-BR',
    channel: 'whatsapp',
    now: new Date('2026-08-14T16:59:59-03:00'),
  });
  assert.equal(result.qualified, true);
  assert.equal(result.handoffStatus, 'queued');
  assert.match(result.messages.join('\n'), /wa\.me\//i);
});
