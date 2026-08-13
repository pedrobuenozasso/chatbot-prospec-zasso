import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureWeekendCampaignEntry,
  matchesWeekendCampaignMessage,
} from '../src/weekend-pilot.mjs';
import { newConversation } from '../src/conversation.mjs';

test('reconhece somente variações inofensivas da mensagem configurada no anúncio', () => {
  assert.equal(matchesWeekendCampaignMessage('Olá! Posso ter mais informações sobre isso?'), true);
  assert.equal(matchesWeekendCampaignMessage('ola posso ter mais informacoes sobre isso'), true);
  assert.equal(matchesWeekendCampaignMessage('  OLÁ, posso ter mais informações sobre isso!!!  '), true);
  assert.equal(matchesWeekendCampaignMessage('Olá! Quero saber o preço.'), false);
  assert.equal(matchesWeekendCampaignMessage('Posso ter informações?'), false);
});

test('marca somente a primeira mensagem de WhatsApp recebida na sexta ou sábado', () => {
  const friday = new Date('2026-08-14T12:00:00-03:00');
  const saturday = new Date('2026-08-15T12:00:00-03:00');
  const thursday = new Date('2026-08-13T12:00:00-03:00');

  for (const now of [friday, saturday]) {
    const state = newConversation();
    assert.equal(captureWeekendCampaignEntry(state, {
      text: 'Olá! Posso ter mais informações sobre isso?',
      channel: 'whatsapp',
      now,
      enabled: true,
    }), true);
    assert.equal(state.entrySource.type, 'ctwa_marker');
  }

  const weekdayState = newConversation();
  assert.equal(captureWeekendCampaignEntry(weekdayState, {
    text: 'Olá! Posso ter mais informações sobre isso?',
    channel: 'whatsapp',
    now: thursday,
    enabled: true,
  }), false);

  const webState = newConversation();
  assert.equal(captureWeekendCampaignEntry(webState, {
    text: 'Olá! Posso ter mais informações sobre isso?',
    channel: 'web',
    now: friday,
    enabled: true,
  }), false);
});

test('não substitui uma origem já registrada', () => {
  const state = newConversation();
  state.entrySource = { type: 'ctwa_referral', detectedAt: '2026-08-14T10:00:00.000Z' };
  assert.equal(captureWeekendCampaignEntry(state, {
    text: 'Olá! Posso ter mais informações sobre isso?',
    channel: 'whatsapp',
    now: new Date('2026-08-14T12:00:00-03:00'),
    enabled: true,
  }), false);
  assert.equal(state.entrySource.type, 'ctwa_referral');
});
