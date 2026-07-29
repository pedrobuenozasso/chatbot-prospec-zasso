import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { config } from './config.mjs';
import { normalizeLanguage, t } from './i18n.mjs';

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

export function newConversation(contact = {}) {
  return {
    stage: STAGES.NEW,
    greeted: false,
    language: normalizeLanguage(contact.language),
    handoffStatus: 'not_ready',
    contact: { firstName: contact.firstName || '' },
    qualification: { segment: null, region: null, crop: null, area: null, areaHectares: null, urbanProfile: null },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function conversationKey(chatId) {
  return createHash('sha256').update(`telegram:${chatId}`).digest('hex');
}

function sanitizedState(state) {
  state.language = normalizeLanguage(state.language);
  state.contact = { firstName: state.contact?.firstName || '' };
  return state;
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
  mkdirSync(dirname(config.conversationStatePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${config.conversationStatePath}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify(conversations, null, 2), { mode: 0o600 });
  renameSync(temporaryPath, config.conversationStatePath);
  chmodSync(config.conversationStatePath, 0o600);
}

export function getConversation(chatId, contact) {
  const conversations = readAll();
  const key = conversationKey(chatId);
  const legacyKey = String(chatId);
  const state = conversations[key] || conversations[legacyKey] || newConversation(contact);
  state.language = normalizeLanguage(state.language || contact?.language);
  state.contact = { firstName: contact?.firstName || state.contact?.firstName || '' };
  // Migra silenciosamente estados antigos que ainda usavam o ID bruto do chat.
  if (conversations[legacyKey]) {
    delete conversations[legacyKey];
    conversations[key] = state;
    writeAll(conversations);
  }
  return state;
}

export function resetConversation(chatId) {
  const conversations = readAll();
  delete conversations[String(chatId)];
  delete conversations[conversationKey(chatId)];
  writeAll(conversations);
}

export function saveConversation(chatId, state) {
  const conversations = readAll();
  state.updatedAt = new Date().toISOString();
  sanitizedState(state);
  delete conversations[String(chatId)];
  conversations[conversationKey(chatId)] = state;
  writeAll(conversations);
}

export function migrateConversationState() {
  if (!existsSync(config.conversationStatePath)) return { migrated: 0 };
  const conversations = readAll();
  let migrated = 0;
  for (const [key, state] of Object.entries(conversations)) {
    sanitizedState(state);
    if (/^\d+$/.test(key)) {
      conversations[conversationKey(key)] = state;
      delete conversations[key];
      migrated += 1;
    }
  }
  // Reescreve também estados já migrados para retirar campos legados e aplicar
  // permissão 0600 a arquivos criados por versões anteriores.
  writeAll(conversations);
  return { migrated };
}

export function qualificationQuestion(stage, language = 'pt-BR') {
  switch (stage) {
    case STAGES.SEGMENT:
      return t(language, 'segmentQuestion');
    case STAGES.REGION:
      return t(language, 'regionQuestion');
    case STAGES.AGRO_CROP:
      return t(language, 'cropQuestion');
    case STAGES.AGRO_AREA:
      return t(language, 'areaQuestion');
    case STAGES.URBAN_PROFILE:
      return t(language, 'urbanProfileQuestion');
    default:
      return null;
  }
}

function detectSegment(answer) {
  const value = normalize(answer);
  if (/(agro|agric|fazenda|finca|farm|rural|produtor|productor|grower|lavoura|cultiv|landwirt|landwirtschaft|bauernhof|exploitation agricole)/.test(value)) return 'agro';
  if (/(urban|urbain|stadt|stadtisch|prefeitura|municip|municipalit|kommune|cidade|ciudad|ville|prestador|prestataire|dienstleister|service provider|servic|contratad)/.test(value)) return 'urban';
  return null;
}

function detectUrbanProfile(answer) {
  const value = normalize(answer);
  if (/(prefeitura|municip|municipalit|kommune|city council|local authority)/.test(value)) return 'prefeitura';
  if (/(prestador|prestataire|dienstleister|service provider|servic|contratad)/.test(value)) return 'prestador_de_servicos';
  if (/(outro|otro|autre|ander|empresa|entreprise|unternehmen|company|particular|condominio)/.test(value)) return 'outro';
  return null;
}

function hectares(answer) {
  const match = normalize(answer).match(/(\d+(?:[.,]\d+)?)\s*(ha|hectare|hectares|hectarea|hectareas|hektar)\b/);
  return match ? Number(match[1].replace(',', '.')) : null;
}

function acknowledgement(stage, language) {
  const keys = {
    [STAGES.SEGMENT]: 'ackSegment',
    [STAGES.REGION]: 'ackRegion',
    [STAGES.AGRO_CROP]: 'ackCrop',
    [STAGES.AGRO_AREA]: 'ackArea',
    [STAGES.URBAN_PROFILE]: 'ackUrbanProfile',
  };
  return keys[stage] ? t(language, keys[stage]) : '';
}

export function advanceQualification(state, answer, language = state.language || 'pt-BR') {
  const locale = normalizeLanguage(language);
  const value = answer.trim();
  if (!value) return { state, nextQuestion: qualificationQuestion(state.stage, locale), acknowledgement: '', completed: false };
  const answeredStage = state.stage;

  if (state.stage === STAGES.SEGMENT) {
    const segment = detectSegment(value);
    if (!segment) {
      return { state, nextQuestion: t(locale, 'segmentClarification'), acknowledgement: '', completed: false };
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
    const parsedArea = hectares(value);
    if (parsedArea === null) {
      return { state, nextQuestion: t(locale, 'areaClarification'), acknowledgement: '', completed: false };
    }
    state.qualification.area = value;
    state.qualification.areaHectares = parsedArea;
    state.stage = STAGES.COMPLETED;
  } else if (state.stage === STAGES.URBAN_PROFILE) {
    const profile = detectUrbanProfile(value);
    if (!profile) {
      return { state, nextQuestion: t(locale, 'urbanProfileClarification'), acknowledgement: '', completed: false };
    }
    state.qualification.urbanProfile = profile;
    state.stage = STAGES.COMPLETED;
  }

  return {
    state,
    nextQuestion: qualificationQuestion(state.stage, locale),
    acknowledgement: acknowledgement(answeredStage, locale),
    completed: state.stage === STAGES.COMPLETED,
  };
}

export { STAGES };
