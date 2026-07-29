import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.mjs';

const STAGES = Object.freeze({
  NEW: 'new',
  SEGMENT: 'segment',
  REGION: 'region',
  AGRO_CROP: 'agro_crop',
  AGRO_AREA: 'agro_area',
  URBAN_PROFILE: 'urban_profile',
  COMPLETED: 'completed',
});

function normalize(value) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function initialState(contact = {}) {
  return {
    stage: STAGES.NEW,
    greeted: false,
    handoffStatus: 'not_ready',
    contact: { firstName: contact.firstName || '', username: contact.username || '' },
    qualification: { segment: null, region: null, crop: null, area: null, areaHectares: null, urbanProfile: null },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function readAll() {
  if (!existsSync(config.conversationStatePath)) return {};
  try {
    return JSON.parse(readFileSync(config.conversationStatePath, 'utf8'));
  } catch {
    return {};
  }
}

function writeAll(conversations) {
  mkdirSync(dirname(config.conversationStatePath), { recursive: true });
  const temporaryPath = `${config.conversationStatePath}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify(conversations, null, 2));
  renameSync(temporaryPath, config.conversationStatePath);
}

export function getConversation(chatId, contact) {
  const conversations = readAll();
  const key = String(chatId);
  const state = conversations[key] || initialState(contact);
  state.contact = { ...state.contact, firstName: contact?.firstName || state.contact.firstName, username: contact?.username || state.contact.username };
  return state;
}

export function saveConversation(chatId, state) {
  const conversations = readAll();
  state.updatedAt = new Date().toISOString();
  conversations[String(chatId)] = state;
  writeAll(conversations);
}

export function qualificationQuestion(stage) {
  switch (stage) {
    case STAGES.SEGMENT:
      return 'Para eu te direcionar melhor, você trabalha mais com agronegócio ou com área urbana?';
    case STAGES.REGION:
      return 'Em qual região ou cidade você atua?';
    case STAGES.AGRO_CROP:
      return 'Qual é o principal cultivo ou aplicação que você tem hoje?';
    case STAGES.AGRO_AREA:
      return 'E qual é o tamanho aproximado da área? Se puder, informe em hectares.';
    case STAGES.URBAN_PROFILE:
      return 'Você atua como prefeitura, prestador de serviços ou em outro tipo de operação?';
    default:
      return null;
  }
}

function detectSegment(answer) {
  const value = normalize(answer);
  if (/(agro|agric|fazenda|rural|produtor|lavoura|cultiv)/.test(value)) return 'agro';
  if (/(urbano|prefeitura|municip|cidade|prestador|servic|contratad)/.test(value)) return 'urban';
  return null;
}

function detectUrbanProfile(answer) {
  const value = normalize(answer);
  if (/(prefeitura|municip)/.test(value)) return 'prefeitura';
  if (/(prestador|servic|contratad)/.test(value)) return 'prestador_de_servicos';
  if (/(outro|empresa|particular|condominio)/.test(value)) return 'outro';
  return null;
}

function hectares(answer) {
  const match = normalize(answer).match(/(\d+(?:[.,]\d+)?)\s*(ha|hectare|hectares)\b/);
  return match ? Number(match[1].replace(',', '.')) : null;
}

export function advanceQualification(state, answer) {
  const value = answer.trim();
  if (!value) return { state, nextQuestion: qualificationQuestion(state.stage), completed: false };

  if (state.stage === STAGES.SEGMENT) {
    const segment = detectSegment(value);
    if (!segment) {
      return { state, nextQuestion: 'Só para eu direcionar certinho: sua atividade é mais ligada ao agronegócio ou a uma área urbana?', completed: false };
    }
    state.qualification.segment = segment;
    state.stage = STAGES.REGION;
  } else if (state.stage === STAGES.REGION) {
    state.qualification.region = value;
    state.stage = state.qualification.segment === 'agro' ? STAGES.AGRO_CROP : STAGES.URBAN_PROFILE;
  } else if (state.stage === STAGES.AGRO_CROP) {
    state.qualification.crop = value;
    state.stage = STAGES.AGRO_AREA;
  } else if (state.stage === STAGES.AGRO_AREA) {
    state.qualification.area = value;
    state.qualification.areaHectares = hectares(value);
    state.stage = STAGES.COMPLETED;
  } else if (state.stage === STAGES.URBAN_PROFILE) {
    const profile = detectUrbanProfile(value);
    if (!profile) {
      return { state, nextQuestion: 'Para eu registrar corretamente, você atua como prefeitura, prestador de serviços ou outro tipo de operação?', completed: false };
    }
    state.qualification.urbanProfile = profile;
    state.stage = STAGES.COMPLETED;
  }

  return { state, nextQuestion: qualificationQuestion(state.stage), completed: state.stage === STAGES.COMPLETED };
}

export { STAGES };
