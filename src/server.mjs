import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from './config.mjs';
import { migrateConversationState } from './conversation.mjs';
import {
  closeDatabase,
  claimDueInactivityReminders,
  claimDueWeekendHandoffs,
  completeInactivityReminder,
  completeWeekendHandoff,
  databaseStatus,
  enforceRetentionPolicy,
  initializeDatabase,
  inactivityReminderStatus,
  weekendHandoffStatus,
} from './database.mjs';
import { secureHandoffStorage } from './handoff.mjs';
import { SUPPORTED_LANGUAGES } from './i18n.mjs';
import { identifierFingerprint, recordEvent } from './observability.mjs';
import { processInboundPersisted } from './persistence.mjs';
import { validateWeekendEncryptionKey } from './weekend-crypto.mjs';

const conversationsInFlight = new Map();
const requestsByConversation = new Map();
const maximumBodyBytes = 32 * 1024;

function json(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(payload);
}

export function isValidBearerAuthorization(authorization, expected = config.chatbotApiToken) {
  const supplied = String(authorization || '').replace(/^Bearer\s+/i, '');
  if (!supplied || !expected) return false;
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

function authorized(request) {
  return isValidBearerAuthorization(request.headers.authorization);
}

function withinRateLimit(conversationId) {
  const now = Date.now();
  const key = identifierFingerprint(conversationId);
  const recent = (requestsByConversation.get(key) || [])
    .filter((timestamp) => now - timestamp < config.chatbotApiRateLimitWindowMs);
  if (recent.length >= config.chatbotApiRateLimitMaxRequests) return false;
  recent.push(now);
  requestsByConversation.set(key, recent);
  return true;
}

async function readJsonBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBodyBytes) {
      const error = new Error('request_body_too_large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('invalid_json');
    error.statusCode = 400;
    throw error;
  }
}

function cleanString(value, maximumLength) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maximumLength);
}

export function validateApiPayload(body) {
  const eventType = cleanString(body.eventType, 16) || 'message';
  const conversationId = cleanString(body.conversationId, 180);
  const messageId = cleanString(body.messageId, 220);
  const text = eventType === 'call'
    ? '[incoming_call]'
    : cleanString(body.text, config.maxQuestionChars + 1);
  const interactionId = cleanString(body.interactionId, 120);
  const firstName = cleanString(body.firstName, 80);
  const language = cleanString(body.language, 16) || 'pt-BR';
  const channel = cleanString(body.channel, 24) || 'whatsapp';
  const recipientNumber = cleanString(body.recipientNumber, 24).replace(/\D/g, '');

  if (!['message', 'call', 'interactive'].includes(eventType)) {
    const error = new Error('unsupported_event_type');
    error.statusCode = 400;
    throw error;
  }
  if (!conversationId || !messageId || (eventType === 'interactive' ? !interactionId : !text)) {
    const error = new Error('missing_required_fields');
    error.statusCode = 400;
    throw error;
  }
  if (text.length > config.maxQuestionChars) {
    const error = new Error('message_too_long');
    error.statusCode = 400;
    throw error;
  }
  if (!['whatsapp', 'web', 'n8n-test'].includes(channel)) {
    const error = new Error('unsupported_channel');
    error.statusCode = 400;
    throw error;
  }
  if (recipientNumber && !/^\d{10,15}$/.test(recipientNumber)) {
    const error = new Error('invalid_recipient_number');
    error.statusCode = 400;
    throw error;
  }
  return {
    conversationId,
    messageId,
    text,
    firstName,
    language,
    channel,
    eventType,
    ...(interactionId ? { interactionId } : {}),
    ...(recipientNumber ? { recipientNumber } : {}),
  };
}

async function serialized(conversationId, task) {
  const previous = conversationsInFlight.get(conversationId) || Promise.resolve();
  const current = previous.catch(() => undefined).then(task);
  conversationsInFlight.set(conversationId, current);
  try {
    return await current;
  } finally {
    if (conversationsInFlight.get(conversationId) === current) conversationsInFlight.delete(conversationId);
  }
}

async function handle(request, response) {
  const url = new URL(request.url, 'http://localhost');
  if (request.method === 'GET' && url.pathname === '/healthz') {
    json(response, 200, {
      status: 'ok',
      service: 'zasso-chatbot',
      version: '0.7.0',
      languages: SUPPORTED_LANGUAGES,
      persistence: databaseStatus(),
    });
    return;
  }
  if (request.method === 'GET' && url.pathname === '/v1/weekend-handoffs/status') {
    if (!authorized(request)) {
      json(response, 401, { error: 'unauthorized' });
      return;
    }
    json(response, 200, await weekendHandoffStatus());
    return;
  }
  if (request.method === 'GET' && url.pathname === '/v1/inactivity-reminders/status') {
    if (!authorized(request)) {
      json(response, 401, { error: 'unauthorized' });
      return;
    }
    json(response, 200, await inactivityReminderStatus());
    return;
  }
  if (request.method === 'POST' && url.pathname === '/v1/inactivity-reminders/claim') {
    if (!authorized(request)) {
      json(response, 401, { error: 'unauthorized' });
      return;
    }
    if (!request.headers['content-type']?.toLocaleLowerCase().startsWith('application/json')) {
      json(response, 415, { error: 'content_type_must_be_json' });
      return;
    }
    const body = await readJsonBody(request);
    json(response, 200, { items: await claimDueInactivityReminders(body.limit) });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/v1/inactivity-reminders/result') {
    if (!authorized(request)) {
      json(response, 401, { error: 'unauthorized' });
      return;
    }
    if (!request.headers['content-type']?.toLocaleLowerCase().startsWith('application/json')) {
      json(response, 415, { error: 'content_type_must_be_json' });
      return;
    }
    const body = await readJsonBody(request);
    const updated = await completeInactivityReminder({
      reminderId: cleanString(body.reminderId, 20),
      status: cleanString(body.status, 16),
      metaMessageId: cleanString(body.metaMessageId, 220),
      errorCode: cleanString(body.errorCode, 120),
    });
    json(response, updated ? 200 : 409, { updated });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/v1/weekend-handoffs/claim') {
    if (!authorized(request)) {
      json(response, 401, { error: 'unauthorized' });
      return;
    }
    if (!request.headers['content-type']?.toLocaleLowerCase().startsWith('application/json')) {
      json(response, 415, { error: 'content_type_must_be_json' });
      return;
    }
    const body = await readJsonBody(request);
    const items = await claimDueWeekendHandoffs(body.limit);
    json(response, 200, { items });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/v1/weekend-handoffs/result') {
    if (!authorized(request)) {
      json(response, 401, { error: 'unauthorized' });
      return;
    }
    if (!request.headers['content-type']?.toLocaleLowerCase().startsWith('application/json')) {
      json(response, 415, { error: 'content_type_must_be_json' });
      return;
    }
    const body = await readJsonBody(request);
    const updated = await completeWeekendHandoff({
      protocol: cleanString(body.protocol, 40),
      status: cleanString(body.status, 16),
      metaMessageId: cleanString(body.metaMessageId, 220),
      errorCode: cleanString(body.errorCode, 80),
    });
    json(response, updated ? 200 : 409, { updated });
    return;
  }
  if (request.method !== 'POST' || url.pathname !== '/v1/messages') {
    json(response, 404, { error: 'not_found' });
    return;
  }
  if (!authorized(request)) {
    recordEvent('api_access_denied');
    json(response, 401, { error: 'unauthorized' });
    return;
  }
  if (!request.headers['content-type']?.toLocaleLowerCase().startsWith('application/json')) {
    json(response, 415, { error: 'content_type_must_be_json' });
    return;
  }

  const payload = validateApiPayload(await readJsonBody(request));
  if (!withinRateLimit(payload.conversationId)) {
    recordEvent('api_rate_limited', {
      conversationFingerprint: identifierFingerprint(payload.conversationId),
    });
    json(response, 429, { error: 'rate_limited' });
    return;
  }

  const result = await serialized(payload.conversationId, () => processInboundPersisted(payload));
  json(response, 200, result);
}

export function createChatbotServer() {
  return createServer((request, response) => {
    handle(request, response).catch((error) => {
      const status = Number(error?.statusCode) || 500;
      if (status >= 500) {
        console.error(`Falha na API do chatbot (${error?.name || 'Error'}).`);
        recordEvent('api_response_error', { errorType: error?.name || 'Error' });
      }
      json(response, status, { error: status >= 500 ? 'internal_error' : error.message });
    });
  });
}

export async function startChatbotServer() {
  if (config.chatbotApiToken.length < 32) {
    throw new Error('CHATBOT_API_TOKEN ausente ou curto. Use um segredo aleatório com pelo menos 32 caracteres.');
  }
  if (config.weekendHandoffEnabled) {
    if (!config.databaseEnabled || !config.databaseRequired) {
      throw new Error('O piloto de fim de semana exige DATABASE_ENABLED=true e DATABASE_REQUIRED=true.');
    }
    validateWeekendEncryptionKey();
    if (!Number.isFinite(Date.parse(config.weekendHandoffReleaseAt))) {
      throw new Error('WEEKEND_HANDOFF_RELEASE_AT ausente ou inválido.');
    }
    if (!/^[a-z0-9_]{3,120}$/.test(config.weekendHandoffTemplateName)) {
      throw new Error('WEEKEND_HANDOFF_TEMPLATE_NAME inválido.');
    }
  }
  if (config.inactivityReminderEnabled) {
    if (!config.databaseEnabled || !config.databaseRequired) {
      throw new Error('O lembrete de inatividade exige DATABASE_ENABLED=true e DATABASE_REQUIRED=true.');
    }
    validateWeekendEncryptionKey();
  }
  migrateConversationState();
  secureHandoffStorage();
  await initializeDatabase();
  const applyRetention = () => {
    enforceRetentionPolicy()
      .then(({ enabled, deletedMessages, expiredConversations }) => {
        if (enabled && (deletedMessages || expiredConversations)) {
          console.log(`Retenção aplicada: ${deletedMessages} mensagens removidas, ${expiredConversations} conversas expiradas.`);
        }
      })
      .catch((error) => {
        console.error(`Falha na retenção (${error?.name || 'Error'}).`);
        recordEvent('retention_policy_error', { errorType: error?.name || 'Error' });
      });
  };
  applyRetention();
  const retentionTimer = setInterval(applyRetention, config.retentionSweepIntervalHours * 60 * 60 * 1000);
  retentionTimer.unref();
  const server = createChatbotServer();
  server.requestTimeout = config.chatbotApiRequestTimeoutMs;
  server.headersTimeout = 15_000;
  server.listen(config.chatbotApiPort, config.chatbotApiHost, () => {
    console.log(`API do chatbot disponível em http://${config.chatbotApiHost}:${config.chatbotApiPort}`);
  });
  server.on('close', () => {
    clearInterval(retentionTimer);
    closeDatabase().catch(() => undefined);
  });
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await startChatbotServer();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
