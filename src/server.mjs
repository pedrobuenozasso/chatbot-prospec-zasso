import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from './config.mjs';
import { migrateConversationState } from './conversation.mjs';
import {
  closeDatabase,
  databaseStatus,
  initializeDatabase,
} from './database.mjs';
import { secureHandoffStorage } from './handoff.mjs';
import { SUPPORTED_LANGUAGES } from './i18n.mjs';
import { identifierFingerprint, recordEvent } from './observability.mjs';
import { processInboundPersisted } from './persistence.mjs';

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
  const conversationId = cleanString(body.conversationId, 180);
  const messageId = cleanString(body.messageId, 220);
  const text = cleanString(body.text, config.maxQuestionChars + 1);
  const firstName = cleanString(body.firstName, 80);
  const language = cleanString(body.language, 16) || 'pt-BR';
  const channel = cleanString(body.channel, 24) || 'whatsapp';

  if (!conversationId || !messageId || !text) {
    const error = new Error('missing_required_fields');
    error.statusCode = 400;
    throw error;
  }
  if (text.length > config.maxQuestionChars) {
    const error = new Error('message_too_long');
    error.statusCode = 400;
    throw error;
  }
  if (channel !== 'whatsapp' && channel !== 'n8n-test') {
    const error = new Error('unsupported_channel');
    error.statusCode = 400;
    throw error;
  }
  return { conversationId, messageId, text, firstName, language, channel };
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
      version: '0.5.1',
      languages: SUPPORTED_LANGUAGES,
      persistence: databaseStatus(),
    });
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
  migrateConversationState();
  secureHandoffStorage();
  await initializeDatabase();
  const server = createChatbotServer();
  server.requestTimeout = config.chatbotApiRequestTimeoutMs;
  server.headersTimeout = 15_000;
  server.listen(config.chatbotApiPort, config.chatbotApiHost, () => {
    console.log(`API do chatbot disponível em http://${config.chatbotApiHost}:${config.chatbotApiPort}`);
  });
  server.on('close', () => {
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
