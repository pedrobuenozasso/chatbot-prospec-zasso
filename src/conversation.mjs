import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { config } from './config.mjs';
import { normalizeLanguage, t } from './i18n.mjs';
import { formatAreaHectares, parseAreaAnswer } from './area.mjs';

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
    entrySource: { type: 'unknown' },
    initialInterest: '',
    interests: [],
    qualificationAttempts: {},
    contact: { firstName: contact.firstName || '' },
    qualification: {
      segment: null,
      region: null,
      crop: null,
      area: null,
      areaHectares: null,
      areaConfidence: null,
      urbanProfile: null,
      urbanScale: null,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function conversationStorageKey(chatId) {
  return createHash('sha256').update(`telegram:${chatId}`).digest('hex');
}

export function conversationExpired(state, now = Date.now()) {
  const updatedAt = Date.parse(state?.updatedAt || '');
  if (!Number.isFinite(updatedAt)) return false;
  return now - updatedAt >= config.conversationInactivityDays * 24 * 60 * 60 * 1000;
}

function sanitizedState(state) {
  state.language = normalizeLanguage(state.language);
  state.contact = { firstName: state.contact?.firstName || '' };
  state.entrySource = ['unknown', 'ctwa_marker', 'ctwa_referral'].includes(state.entrySource?.type)
    ? {
        type: state.entrySource.type,
        detectedAt: state.entrySource.detectedAt || undefined,
      }
    : { type: 'unknown' };
  if (state.weekendHandoff && typeof state.weekendHandoff === 'object') {
    state.weekendHandoff = {
      eligible: state.weekendHandoff.eligible === true,
      reason: String(state.weekendHandoff.reason || '').slice(0, 48),
      sourceType: ['ctwa_marker', 'ctwa_referral'].includes(state.weekendHandoff.sourceType)
        ? state.weekendHandoff.sourceType
        : undefined,
      firstInboundAt: state.weekendHandoff.firstInboundAt || undefined,
      scheduledFor: state.weekendHandoff.scheduledFor || undefined,
      freeEntryExpiresAt: state.weekendHandoff.freeEntryExpiresAt || undefined,
    };
  }
  state.initialInterest = String(state.initialInterest || '')
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  state.interests = [...new Set((Array.isArray(state.interests) ? state.interests : [])
    .map((value) => String(value || '')
      .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180))
    .filter(Boolean))].slice(-5);
  state.qualificationAttempts = Object.fromEntries(
    Object.entries(state.qualificationAttempts || {})
      .filter(([stage, attempts]) => Object.values(STAGES).includes(stage) && Number.isInteger(attempts))
      .map(([stage, attempts]) => [stage, Math.max(0, Math.min(attempts, 3))]),
  );
  state.qualification ||= {};
  state.qualification.areaConfidence = state.qualification.areaConfidence || null;
  state.qualification.urbanScale = String(state.qualification.urbanScale || '')
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || null;
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

export function findConversation(chatId, contact) {
  const conversations = readAll();
  const key = conversationStorageKey(chatId);
  const legacyKey = String(chatId);
  const state = conversations[key] || conversations[legacyKey];
  if (!state) return null;
  if (conversationExpired(state)) {
    delete conversations[legacyKey];
    delete conversations[key];
    writeAll(conversations);
    return null;
  }
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

export function getConversation(chatId, contact) {
  return findConversation(chatId, contact) || newConversation(contact);
}

export function resetConversation(chatId) {
  const conversations = readAll();
  delete conversations[String(chatId)];
  delete conversations[conversationStorageKey(chatId)];
  writeAll(conversations);
}

export function saveConversation(chatId, state) {
  const conversations = readAll();
  state.updatedAt = new Date().toISOString();
  sanitizedState(state);
  delete conversations[String(chatId)];
  conversations[conversationStorageKey(chatId)] = state;
  writeAll(conversations);
}

export function restoreConversation(chatId, state) {
  const conversations = readAll();
  const restored = structuredClone(state);
  sanitizedState(restored);
  delete conversations[String(chatId)];
  conversations[conversationStorageKey(chatId)] = restored;
  writeAll(conversations);
}

export function migrateConversationState() {
  if (!existsSync(config.conversationStatePath)) return { migrated: 0 };
  const conversations = readAll();
  let migrated = 0;
  for (const [key, state] of Object.entries(conversations)) {
    sanitizedState(state);
    if (/^\d+$/.test(key)) {
      conversations[conversationStorageKey(key)] = state;
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
  if (/(prefeitura|municip|municipalit|kommune|gemeinde|city council|local authority|junta de freguesia|camara municipal|ayuntamiento)/.test(value)) return 'prefeitura';
  if (/(prestador|prestataire|dienstleister|service provider|servic|contratad)/.test(value)) return 'prestador_de_servicos';
  if (/(outro|otro|autre|ander|empresa|entreprise|unternehmen|company|particular|condominio)/.test(value)) return 'outro';
  return null;
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
  let locale = normalizeLanguage(language);
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
    if (state.language === 'pt-BR' && /\b(portugal|portuguesa?|lisboa|porto|braga|coimbra|aveiro|faro|setubal|leiria|viseu)\b/i.test(normalize(value))) {
      state.language = 'pt-PT';
      locale = 'pt-PT';
    }
    state.stage = state.qualification.segment === 'agro' ? STAGES.AGRO_CROP : STAGES.URBAN_PROFILE;
  } else if (state.stage === STAGES.AGRO_CROP) {
    state.qualification.crop = value;
    state.stage = STAGES.AGRO_AREA;
  } else if (state.stage === STAGES.AGRO_AREA) {
    const parsedArea = parseAreaAnswer(value, locale);
    if (!parsedArea) {
      return { state, nextQuestion: t(locale, 'areaClarification'), acknowledgement: '', completed: false };
    }
    state.qualification.area = formatAreaHectares(parsedArea.areaHectares, locale);
    state.qualification.areaHectares = parsedArea.areaHectares;
    state.qualification.areaConfidence = parsedArea.confidence;
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
