import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceQualification, STAGES } from '../src/conversation.mjs';
import { assessQualificationReply, localQualificationAssessment, partitionQualificationMessage } from '../src/rag.mjs';

function lead() {
  return {
    stage: STAGES.SEGMENT,
    qualification: { segment: null, region: null, crop: null, area: null, areaHectares: null, urbanProfile: null },
  };
}

async function submit(state, message) {
  const assessment = await assessQualificationReply(state.stage, message);
  if (assessment.kind === 'answer') return advanceQualification(state, message);
  return { state, assessment, completed: false };
}

test('fluxo agro aceita variações comuns e termina com hectares', async () => {
  const state = lead();
  await submit(state, 'Sou produtor rural');
  assert.equal(state.qualification.segment, 'agro');
  assert.equal(state.stage, STAGES.REGION);

  await submit(state, 'Campinas');
  assert.equal(state.qualification.region, 'Campinas');
  assert.equal(state.stage, STAGES.AGRO_CROP);

  await submit(state, 'Soja');
  assert.equal(state.qualification.crop, 'Soja');
  assert.equal(state.stage, STAGES.AGRO_AREA);

  const completed = await submit(state, '250,5 hectares');
  assert.equal(completed.completed, true);
  assert.equal(state.qualification.areaHectares, 250.5);
});

test('fluxo urbano aceita município, região e prestador de serviços', async () => {
  const state = lead();
  await submit(state, 'Atendo áreas urbanas');
  assert.equal(state.qualification.segment, 'urban');

  await submit(state, 'Mato Grosso');
  assert.equal(state.qualification.region, 'Mato Grosso');
  assert.equal(state.stage, STAGES.URBAN_PROFILE);

  const completed = await submit(state, 'Somos prestadores de serviços');
  assert.equal(completed.completed, true);
  assert.equal(state.qualification.urbanProfile, 'prestador_de_servicos');
});

test('fluxo urbano reconhece prefeitura e outro perfil', async () => {
  const prefeitura = lead();
  await submit(prefeitura, 'Prefeitura');
  await submit(prefeitura, 'Curitiba, PR');
  await submit(prefeitura, 'Prefeitura municipal');
  assert.equal(prefeitura.qualification.urbanProfile, 'prefeitura');

  const outro = lead();
  await submit(outro, 'Urbano');
  await submit(outro, 'São Paulo');
  await submit(outro, 'Condomínio residencial');
  assert.equal(outro.qualification.urbanProfile, 'outro');
});

test('não avança quando a resposta é inválida para o campo atual', () => {
  assert.equal(localQualificationAssessment('region', 'mato').kind, 'invalid');
  assert.equal(localQualificationAssessment('region', 'celular').kind, 'invalid');
  assert.equal(localQualificationAssessment('agro_crop', 'celular').kind, 'invalid');
  assert.equal(localQualificationAssessment('agro_area', 'uma área grande').kind, 'invalid');
  assert.equal(localQualificationAssessment('urban_profile', 'talvez').kind, 'invalid');
});

test('reconhece número isolado como área quando a etapa solicita hectares', () => {
  for (const answer of ['100', '100,5', '1.200', '1,200.5']) {
    assert.equal(localQualificationAssessment('agro_area', answer).kind, 'answer', answer);
  }
});

test('aceita cidades curtas capitalizadas sem aceitar termos bloqueados', () => {
  for (const city of ['Lyon', 'Bonn', 'Paris', 'Itu', 'Jaú']) {
    assert.equal(localQualificationAssessment('region', city).kind, 'answer');
  }
  assert.equal(localQualificationAssessment('region', 'Mato').kind, 'invalid');
  assert.equal(localQualificationAssessment('region', 'Celular').kind, 'invalid');
});

test('identifica perguntas no meio de qualquer etapa e preserva o estágio', () => {
  const questions = [
    ['segment', 'O que é a Zasso?'],
    ['region', 'Onde a Zasso atua?'],
    ['agro_crop', 'Como a capina elétrica funciona?'],
    ['agro_area', 'A tecnologia funciona em soja?'],
    ['urban_profile', 'Qual é o valor?'],
  ];
  for (const [stage, message] of questions) {
    assert.equal(localQualificationAssessment(stage, message).kind, 'question');
  }
});

test('separa resposta de qualificação e pergunta na mesma mensagem', () => {
  const examples = [
    ['segment', 'Agricultura\nQual o rendimento da máquina em hectares por hora?', 'Agricultura'],
    ['segment', 'Sou do agro, qual o valor?', 'Sou do agro'],
    ['region', 'Campinas/SP. Onde encontro uma demonstração?', 'Campinas/SP.'],
    ['agro_crop', 'Soja; funciona em plantas resistentes?', 'Soja'],
    ['agro_area', '120 hectares e qual é a velocidade ideal?', '120 hectares'],
    ['urban_profile', 'Prefeitura, qual é o investimento?', 'Prefeitura'],
  ];

  for (const [stage, message, expectedAnswer] of examples) {
    const result = partitionQualificationMessage(stage, message);
    assert.equal(result?.kind, 'compound');
    assert.equal(result?.answer, expectedAnswer);
    assert.match(result?.question || '', /\?|onde|funciona/i);
  }
});

test('separa resposta e pergunta de segmento nos cinco idiomas', () => {
  const examples = [
    ['Agricultura, quantos hectares por hora a máquina atende?', 'Agricultura'],
    ['Agriculture, what is the field capacity per hour?', 'Agriculture'],
    ['Landwirtschaft, wie hoch ist die Flächenleistung pro Stunde?', 'Landwirtschaft'],
    ['Agriculture, quelle est la capacité par heure ?', 'Agriculture'],
    ['Agricultura, ¿cuántas hectáreas por hora puede tratar?', 'Agricultura'],
  ];

  for (const [message, expectedAnswer] of examples) {
    const result = partitionQualificationMessage('segment', message);
    assert.equal(result?.kind, 'compound', message);
    assert.equal(result?.answer, expectedAnswer, message);
    assert.match(result?.question || '', /\?/u, message);
  }
});

test('valida semanticamente respostas multilíngues sem depender do Worker', () => {
  const cases = [
    ['segment', 'Ich arbeite in der Landwirtschaft'],
    ['segment', 'Je travaille dans l’agriculture'],
    ['segment', 'Trabajo en agricultura'],
    ['agro_crop', 'Weizen'],
    ['agro_crop', 'blé'],
    ['agro_area', '120 Hektar'],
    ['agro_area', '75 hectáreas'],
    ['urban_profile', 'municipalité'],
    ['urban_profile', 'Dienstleister'],
  ];
  for (const [stage, message] of cases) {
    assert.equal(localQualificationAssessment(stage, message).kind, 'answer');
  }
});
