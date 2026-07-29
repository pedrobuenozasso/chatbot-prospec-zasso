import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceQualification, qualificationQuestion, STAGES } from '../src/conversation.mjs';
import { qualifiedLeadSummary } from '../src/handoff.mjs';

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
