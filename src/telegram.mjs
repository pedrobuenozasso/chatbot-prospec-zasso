import { processInboundMessage } from './agent.mjs';
import { config } from './config.mjs';
import { migrateConversationState } from './conversation.mjs';
import { secureHandoffStorage } from './handoff.mjs';
import { normalizeLanguage, t } from './i18n.mjs';
import { identifierFingerprint, recordEvent } from './observability.mjs';
import { typingDelayFor } from './pacing.mjs';

const telegramApi = `https://api.telegram.org/bot${config.telegramToken}`;
const requestsByChat = new Map();

async function telegram(method, body) {
  const response = await fetch(`${telegramApi}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description || response.status}`);
  return data.result;
}

async function sendWithTyping(chatId, text) {
  await telegram('sendChatAction', { chat_id: chatId, action: 'typing' });
  await new Promise((resolve) => setTimeout(resolve, typingDelayFor(text)));
  return telegram('sendMessage', { chat_id: chatId, text });
}

function canUse(chatId) {
  return config.allowedChatIds.size > 0 && config.allowedChatIds.has(String(chatId));
}

function withinRateLimit(chatId) {
  const now = Date.now();
  const recentRequests = (requestsByChat.get(chatId) || [])
    .filter((timestamp) => now - timestamp < config.telegramRateLimitWindowMs);
  if (recentRequests.length >= config.telegramRateLimitMaxRequests) return false;
  recentRequests.push(now);
  requestsByChat.set(chatId, recentRequests);
  return true;
}

async function respond(message) {
  const chatId = message.chat.id;
  const text = message.text?.trim() || '';
  const telegramLanguage = normalizeLanguage(message.from?.language_code);
  console.log(`Mensagem recebida do chat ${identifierFingerprint(chatId)}.`);
  if (!canUse(chatId)) {
    recordEvent('access_denied', { chatFingerprint: identifierFingerprint(chatId) });
    console.warn(`Acesso recusado ao chat ${identifierFingerprint(chatId)}.`);
    return;
  }

  if (!withinRateLimit(chatId)) {
    recordEvent('rate_limited', { chatFingerprint: identifierFingerprint(chatId) });
    await telegram('sendMessage', { chat_id: chatId, text: t(language, 'rateLimited') });
    return;
  }

  try {
    const result = await processInboundMessage({
      conversationId: chatId,
      messageId: String(message.message_id || ''),
      text,
      firstName: message.from?.first_name,
      language: telegramLanguage,
    });
    for (const reply of result.messages) await sendWithTyping(chatId, reply);
  } catch (error) {
    console.error(`Falha ao responder no Telegram (${error?.name || 'Error'}).`);
    recordEvent('response_error', { chatFingerprint: identifierFingerprint(chatId), errorType: error?.name || 'Error' });
    await telegram('sendMessage', {
      chat_id: chatId,
      text: t(telegramLanguage, 'temporaryError'),
    });
  }
}

if (!config.telegramToken) {
  console.error('TELEGRAM_BOT_TOKEN não configurado. Copie .env.example para .env e informe o token.');
  process.exit(1);
}
if (config.allowedChatIds.size === 0) {
  console.error('TELEGRAM_ALLOWED_CHAT_IDS não configurado. O bot não inicia sem uma lista explícita de chats autorizados.');
  process.exit(1);
}

migrateConversationState();
secureHandoffStorage();
console.log('Bot Telegram iniciado por long polling. Use Ctrl+C para parar.');
let offset = 0;
while (true) {
  try {
    const updates = await telegram('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
    for (const update of updates) {
      offset = update.update_id + 1;
      if (update.message) await respond(update.message);
    }
  } catch (error) {
    console.error(`Falha no long polling: ${error.message}`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}
