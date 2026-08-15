import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
export const projectRoot = resolve(moduleDirectory, '..');

function loadDotEnv() {
  const envPath = resolve(projectRoot, '.env');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const [, key, rawValue] = match;
    process.env[key] = rawValue.replace(/^(["'])(.*)\1$/, '$2');
  }
}

loadDotEnv();

function booleanEnvironment(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value.toLocaleLowerCase() === 'true';
}

function databaseSchema(value) {
  const schema = value || 'public';
  if (!/^[a-z_][a-z0-9_]*$/i.test(schema)) {
    throw new Error('DATABASE_SCHEMA deve conter somente letras, números e underscore.');
  }
  return schema;
}

function positiveIntegerEnvironment(name, fallback, minimum = 1, maximum = 3650) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} deve ser um inteiro entre ${minimum} e ${maximum}.`);
  }
  return value;
}

const weekendCampaignMessages = [
  process.env.WEEKEND_HANDOFF_CAMPAIGN_MESSAGE,
  'Olá! Posso ter mais informações sobre isso?',
  'Olá! Posso saber mais informações sobre isto?',
  'Hello! I would like to get more information about this.',
  'Hallo! Ich möchte gerne weitere Informationen dazu erhalten.',
  'Bonjour ! Je souhaiterais obtenir plus d’informations à ce sujet.',
  '¡Hola! Me gustaría conseguir más información sobre esto.',
  ...(process.env.WEEKEND_HANDOFF_CAMPAIGN_MESSAGES || '').split('||'),
]
  .map((value) => String(value || '').trim())
  .filter((value, index, values) => value && value.length <= 240 && values.indexOf(value) === index);

export const config = {
  faqDirectory: resolve(projectRoot, 'knowledge/public-faq'),
  indexPath: resolve(projectRoot, '.index/faq-index.json'),
  ollamaBaseUrl: (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, ''),
  embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'qwen3-embedding:0.6b',
  retrievalMode: process.env.RAG_RETRIEVAL_MODE || 'lexical',
  minRetrievalScore: Number(process.env.MIN_RETRIEVAL_SCORE || '0.15'),
  sacfAiBaseUrl: (process.env.SACF_AI_BASE_URL || 'https://ai.sacf.io').replace(/\/$/, ''),
  sacfAiServiceToken: process.env.SACF_AI_SERVICE_TOKEN || '',
  sacfAiModel: process.env.SACF_AI_MODEL || 'qwen2.5:14b',
  sacfAiTenantLabel: process.env.SACF_AI_TENANT_LABEL || 'Zasso',
  sacfAiPriority: Number(process.env.SACF_AI_PRIORITY || '3'),
  sacfAiJobTimeoutMs: Number(process.env.SACF_AI_JOB_TIMEOUT_MS || '90000'),
  qualificationAiTimeoutMs: Number(process.env.QUALIFICATION_AI_TIMEOUT_MS || '12000'),
  maxQuestionChars: Number(process.env.MAX_QUESTION_CHARS || '800'),
  maxContextChars: Number(process.env.MAX_CONTEXT_CHARS || '12000'),
  maxAnswerChars: Number(process.env.MAX_ANSWER_CHARS || '1400'),
  preferredAnswerChars: Number(process.env.PREFERRED_ANSWER_CHARS || '700'),
  conversationStatePath: resolve(process.env.CONVERSATION_STATE_PATH || resolve(projectRoot, '.state/conversations.json')),
  handoffOutboxPath: resolve(process.env.HANDOFF_OUTBOX_PATH || resolve(projectRoot, '.outbox/qualified-leads.jsonl')),
  commercialWhatsAppNumber: (process.env.COMMERCIAL_WHATSAPP_NUMBER || '5511967702212').replace(/\D/g, ''),
  // Piloto de fim de semana. Permanece desligado até fila, template e rollback
  // terem sido validados com números internos.
  weekendHandoffEnabled: booleanEnvironment('WEEKEND_HANDOFF_ENABLED'),
  weekendHandoffCampaignMessage: process.env.WEEKEND_HANDOFF_CAMPAIGN_MESSAGE
    || 'Olá! Posso ter mais informações sobre isso?',
  weekendHandoffCampaignMessages: weekendCampaignMessages,
  weekendHandoffTimezone: process.env.WEEKEND_HANDOFF_TIMEZONE || 'America/Sao_Paulo',
  weekendHandoffReleaseAt: process.env.WEEKEND_HANDOFF_RELEASE_AT || '',
  weekendHandoffEncryptionKey: process.env.WEEKEND_HANDOFF_ENCRYPTION_KEY || '',
  weekendHandoffTemplateName: process.env.WEEKEND_HANDOFF_TEMPLATE_NAME
    || 'zasso_continuar_atendimento_fds',
  weekendHandoffClaimLimit: positiveIntegerEnvironment('WEEKEND_HANDOFF_CLAIM_LIMIT', 25, 1, 100),
  chatbotApiHost: process.env.CHATBOT_API_HOST || '127.0.0.1',
  chatbotApiPort: Number(process.env.CHATBOT_API_PORT || '3000'),
  chatbotApiToken: process.env.CHATBOT_API_TOKEN || '',
  chatbotApiRequestTimeoutMs: Number(process.env.CHATBOT_API_REQUEST_TIMEOUT_MS || '120000'),
  chatbotApiRateLimitMaxRequests: Number(process.env.CHATBOT_API_RATE_LIMIT_MAX_REQUESTS || '12'),
  chatbotApiRateLimitWindowMs: Number(process.env.CHATBOT_API_RATE_LIMIT_WINDOW_MS || '60000'),
  telegramRateLimitMaxRequests: Number(process.env.TELEGRAM_RATE_LIMIT_MAX_REQUESTS || '8'),
  telegramRateLimitWindowMs: Number(process.env.TELEGRAM_RATE_LIMIT_WINDOW_MS || '60000'),
  replyTypingMinMs: Number(process.env.REPLY_TYPING_MIN_MS || '900'),
  replyTypingMaxMs: Number(process.env.REPLY_TYPING_MAX_MS || '2200'),
  // A conversa volta a ser uma nova triagem depois deste período sem contato.
  conversationInactivityDays: positiveIntegerEnvironment('CONVERSATION_INACTIVITY_DAYS', 15),
  // O texto integral é removido no mesmo prazo; resumos comerciais seguem sua política própria.
  messageRetentionDays: positiveIntegerEnvironment('MESSAGE_RETENTION_DAYS', 15),
  retentionSweepIntervalHours: positiveIntegerEnvironment('RETENTION_SWEEP_INTERVAL_HOURS', 24, 1, 168),
  showSources: (process.env.SHOW_SOURCES || 'false').toLocaleLowerCase() === 'true',
  databaseEnabled: booleanEnvironment('DATABASE_ENABLED'),
  databaseRequired: booleanEnvironment('DATABASE_REQUIRED'),
  databaseHost: process.env.DATABASE_HOST || process.env.PGHOST || 'cloud-sql-proxy',
  databasePort: Number(process.env.DATABASE_PORT || process.env.PGPORT || '5432'),
  databaseName: process.env.DATABASE_NAME || process.env.CLOUDSQL_DB_NAME || process.env.PGDATABASE || '',
  databaseUser: process.env.DATABASE_USER || process.env.CLOUDSQL_DB_USER || process.env.PGUSER || '',
  databasePassword: process.env.DATABASE_PASSWORD || process.env.CLOUDSQL_DB_PASSWORD || process.env.PGPASSWORD || '',
  databaseSchema: databaseSchema(process.env.DATABASE_SCHEMA || process.env.CLOUDSQL_DB_SCHEMA),
  databaseSslMode: (process.env.DATABASE_SSL_MODE || process.env.PGSSLMODE || 'disable').toLocaleLowerCase(),
  databasePoolMax: Number(process.env.DATABASE_POOL_MAX || '5'),
  databaseConnectTimeoutMs: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS || '10000'),
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  allowedChatIds: new Set(
    (process.env.TELEGRAM_ALLOWED_CHAT_IDS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  ),
};
