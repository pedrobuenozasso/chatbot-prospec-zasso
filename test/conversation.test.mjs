import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceQualification, newConversation, qualificationQuestion, STAGES } from '../src/conversation.mjs';
import { commercialHandoff, qualifiedLeadSummary } from '../src/handoff.mjs';

function state() {
  return {
    stage: STAGES.SEGMENT,
    handoffStatus: 'not_ready',
    contact: { firstName: 'Ana', username: '' },
    qualification: { segment: null, region: null, crop: null, area: null, areaHectares: null, urbanProfile: null },
  };
}

test('qualifica um lead agro até área em hectares', () => {
  const lead = state();
  let progress = advanceQualification(lead, 'Agronegócio');
  assert.equal(progress.state.qualification.segment, 'agro');
  assert.equal(progress.nextQuestion, qualificationQuestion(STAGES.REGION));

  progress = advanceQualification(lead, 'Ribeirão Preto, SP');
  assert.equal(progress.nextQuestion, qualificationQuestion(STAGES.AGRO_CROP));

  progress = advanceQualification(lead, 'Cana-de-açúcar');
  assert.equal(progress.nextQuestion, qualificationQuestion(STAGES.AGRO_AREA));

  progress = advanceQualification(lead, '150 hectares');
  assert.equal(progress.completed, true);
  assert.equal(lead.qualification.areaHectares, 150);

  const summary = qualifiedLeadSummary(lead);
  assert.equal(summary.segment, 'Agronegócio');
  assert.equal(summary.areaHectares, 150);
});

test('aceita somente o número quando a etapa atual já pergunta hectares', () => {
  const examples = [
    ['pt-BR', '100', 100, '100 hectares'],
    ['pt-BR', '100,5', 100.5, '100,5 hectares'],
    ['pt-BR', '1.200', 1200, '1.200 hectares'],
    ['en-US', '1,200.5', 1200.5, '1,200.5 hectares'],
    ['de-DE', '80', 80, '80 Hektar'],
    ['fr-FR', '75', 75, '75 hectares'],
    ['es-ES', '60', 60, '60 hectáreas'],
  ];

  for (const [language, answer, expectedNumber, expectedText] of examples) {
    const lead = state();
    lead.language = language;
    lead.stage = STAGES.AGRO_AREA;
    lead.qualification.segment = 'agro';
    const progress = advanceQualification(lead, answer, language);
    assert.equal(progress.completed, true, `${language}: ${answer}`);
    assert.equal(lead.qualification.areaHectares, expectedNumber, `${language}: ${answer}`);
    assert.equal(lead.qualification.area, expectedText, `${language}: ${answer}`);
  }
});

test('entende área informada naturalmente e converte unidades para hectares', () => {
  const examples = [
    ['Temos uma associação, trabalhamos no compartilhamento de máquinas. Posso estimar em uma área aproximada de 20 ha.', 20, '20 hectares'],
    ['Em média 500 hectares.', 500, '500 hectares'],
    ['200.000 metros quadrados.', 20, '20 hectares'],
    ['A propriedade tem aproximadamente 1,5 km².', 150, '150 hectares'],
    ['We operate an area of about 100 acres.', 40.468564224, '40,4686 hectares'],
  ];

  for (const [answer, expectedNumber, expectedText] of examples) {
    const lead = state();
    lead.stage = STAGES.AGRO_AREA;
    lead.qualification.segment = 'agro';
    const progress = advanceQualification(lead, answer, 'pt-BR');
    assert.equal(progress.completed, true, answer);
    assert.equal(lead.qualification.areaHectares, expectedNumber, answer);
    assert.equal(lead.qualification.area, expectedText, answer);
  }
});

test('não confunde capacidade por hora com o tamanho da área do lead', () => {
  const lead = state();
  lead.stage = STAGES.AGRO_AREA;
  lead.qualification.segment = 'agro';
  const progress = advanceQualification(lead, 'A máquina faz 20 hectares por hora?', 'pt-BR');
  assert.equal(progress.completed, false);
  assert.equal(lead.stage, STAGES.AGRO_AREA);
  assert.equal(lead.qualification.areaHectares, null);
});

test('qualifica um lead urbano até o perfil de atuação', () => {
  const lead = state();
  let progress = advanceQualification(lead, 'Urbano');
  assert.equal(progress.state.qualification.segment, 'urban');

  progress = advanceQualification(lead, 'Campinas, SP');
  assert.equal(progress.nextQuestion, qualificationQuestion(STAGES.URBAN_PROFILE));

  progress = advanceQualification(lead, 'Prestador de serviços');
  assert.equal(progress.completed, true);
  assert.equal(lead.qualification.urbanProfile, 'prestador_de_servicos');

  const summary = qualifiedLeadSummary(lead);
  assert.equal(summary.urbanProfile, 'Prestador de serviços');
});

test('pede esclarecimento quando o segmento não está claro', () => {
  const lead = state();
  const progress = advanceQualification(lead, 'Não sei');
  assert.equal(progress.state.stage, STAGES.SEGMENT);
  assert.match(progress.nextQuestion, /agronegócio ou a uma área urbana/i);
});

test('inicia uma nova conversa sem dados de qualificação anteriores', () => {
  const lead = newConversation({ firstName: 'Ana' });
  assert.equal(lead.stage, STAGES.NEW);
  assert.equal(lead.qualification.segment, null);
  assert.equal(lead.contact.firstName, 'Ana');
});

test('localiza perguntas e confirmações sem parecer robótico', () => {
  const languages = [
    ['pt-BR', /Entendi\./, /região ou cidade/i],
    ['en-US', /Got it\./, /region or city/i],
    ['de-DE', /Verstanden\./, /Region oder Stadt/i],
    ['fr-FR', /Je comprends\./, /région ou ville/i],
    ['es-ES', /Entiendo\./, /región o ciudad/i],
  ];
  for (const [language, expectedAck, expectedQuestion] of languages) {
    const lead = state();
    lead.language = language;
    const progress = advanceQualification(lead, language === 'de-DE' ? 'Landwirtschaft' : 'Agriculture', language);
    assert.match(progress.acknowledgement, expectedAck);
    assert.match(progress.nextQuestion, expectedQuestion);
  }
});

test('qualifica respostas comuns em alemão, francês e espanhol', () => {
  const examples = [
    ['de-DE', ['Landwirtschaft', 'München', 'Weizen', '120 Hektar']],
    ['fr-FR', ['Agriculture', 'Lyon', 'blé', '80 hectares']],
    ['es-ES', ['Agricultura', 'Sevilla', 'soja', '95 hectáreas']],
  ];
  for (const [language, replies] of examples) {
    const lead = state();
    lead.language = language;
    let progress;
    for (const reply of replies) progress = advanceQualification(lead, reply, language);
    assert.equal(progress.completed, true);
    assert.ok(lead.qualification.areaHectares > 0);
  }
});

test('gera handoff agro para o WhatsApp comercial com resumo curto e URL segura', () => {
  const lead = state();
  lead.language = 'pt-BR';
  lead.handoffProtocol = 'ZAS-20260730-ABC123';
  lead.initialInterest = 'Quero saber o valor\nsem repetir tudo';
  lead.qualification = {
    segment: 'agro',
    region: 'Ribeirão Preto/SP',
    crop: 'Cana-de-açúcar',
    area: '350 hectares',
    areaHectares: 350,
    urbanProfile: null,
  };

  const handoff = commercialHandoff(lead);
  assert.equal(handoff.number, '5511967702212');
  assert.match(handoff.url, /^https:\/\/wa\.me\/5511967702212\?text=/);
  assert.match(handoff.message, /• Segmento: Agronegócio/);
  assert.match(handoff.message, /• Região: Ribeirão Preto\/SP/);
  assert.match(handoff.message, /• Cultivo\/aplicação: Cana-de-açúcar/);
  assert.match(handoff.message, /• Área: 350 hectares/);
  assert.match(handoff.message, /• Interesse: Quero saber o valor sem repetir tudo/);
  assert.match(handoff.message, /Protocolo: ZAS-20260730-ABC123/);
  assert.equal(new URL(handoff.url).searchParams.get('text'), handoff.message);
});

test('gera handoff urbano sem campos agrícolas e localiza o texto', () => {
  const lead = state();
  lead.language = 'en-US';
  lead.handoffProtocol = 'ZAS-20260730-URB123';
  lead.qualification = {
    segment: 'urban',
    region: 'Campinas/SP',
    crop: null,
    area: null,
    areaHectares: null,
    urbanProfile: 'prestador_de_servicos',
  };

  const handoff = commercialHandoff(lead);
  assert.match(handoff.message, /Summary of my request/);
  assert.match(handoff.message, /• Segment: Urban area/);
  assert.match(handoff.message, /• Profile: Service provider/);
  assert.doesNotMatch(handoff.message, /Crop\/application|• Area:/);
});
