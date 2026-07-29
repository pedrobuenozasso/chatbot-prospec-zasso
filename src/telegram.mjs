import { config } from './config.mjs';
import { advanceQualification, getConversation, migrateConversationState, qualificationQuestion, resetConversation, saveConversation, STAGES } from './conversation.mjs';
import { queueQualifiedLead, secureHandoffStorage } from './handoff.mjs';
import { normalizeLanguage, t } from './i18n.mjs';
import { identifierFingerprint, recordEvent } from './observability.mjs';
import { typingDelayFor } from './pacing.mjs';
import { answer, assessQualificationReply, isPromptInjection } from './rag.mjs';

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

function sourceList(sources, language) {
  if (!config.showSources || !sources.length) return '';
  return `\n\n${t(language, 'sourceLabel')}: ${sources.map((source) => source.faqId).join(', ')}`;
}

function needsGreeting(state, answerText) {
  return !state.greeted && !/^(olá|oi|bom dia|boa tarde|boa noite|hello|hi|good morning|good afternoon|good evening|hallo|guten|bonjour|salut|bonsoir|hola|buenos|buenas)/iu.test(answerText);
}

function humanizedProgress(progress) {
  return [progress.acknowledgement, progress.nextQuestion].filter(Boolean).join(' ');
}

async function finishQualification(chatId, state) {
  if (state.handoffStatus === 'queued') return;
  const result = queueQualifiedLead(state);
  state.handoffStatus = result.status;
  saveConversation(chatId, state);
  recordEvent('lead_qualified', {
    chatFingerprint: identifierFingerprint(chatId),
    segment: state.qualification.segment,
    handoffStatus: result.status,
  });
}

async function respond(message) {
  const chatId = message.chat.id;
  const text = message.text?.trim() || '';
  const telegramLanguage = normalizeLanguage(message.from?.language_code);
  const state = getConversation(chatId, { firstName: message.from?.first_name, language: telegramLanguage });
  const language = state.language || telegramLanguage;
  console.log(`Mensagem recebida do chat ${identifierFingerprint(chatId)}.`);
  if (!canUse(chatId)) {
    recordEvent('access_denied', { chatFingerprint: identifierFingerprint(chatId) });
    console.warn(`Acesso recusado ao chat ${identifierFingerprint(chatId)}.`);
    return;
  }

  if (['/start', '/reset', '/restart', '/reiniciar', '/neustart', '/recommencer'].includes(text.toLocaleLowerCase())) {
    resetConversation(chatId);
    await telegram('sendMessage', {
      chat_id: chatId,
      text: `${t(telegramLanguage, 'welcome')}\n\n${t(telegramLanguage, 'reset')}`,
    });
    return;
  }
  if (text === '/help') {
    await telegram('sendMessage', { chat_id: chatId, text: t(language, 'welcome') });
    return;
  }
  if (text === '/examples') {
    await telegram('sendMessage', { chat_id: chatId, text: t(language, 'examples') });
    return;
  }
  if (!text) {
    await telegram('sendMessage', { chat_id: chatId, text: t(language, 'textOnly') });
    return;
  }
  if (!withinRateLimit(chatId)) {
    recordEvent('rate_limited', { chatFingerprint: identifierFingerprint(chatId) });
    await telegram('sendMessage', { chat_id: chatId, text: t(language, 'rateLimited') });
    return;
  }

  try {
    if (state.stage !== STAGES.NEW && state.stage !== STAGES.COMPLETED) {
      await telegram('sendChatAction', { chat_id: chatId, action: 'typing' });
      if (isPromptInjection(text)) {
        const blocked = await answer(text, language);
        await sendWithTyping(chatId, blocked.answer);
        await sendWithTyping(chatId, qualificationQuestion(state.stage, language));
        return;
      }
      const assessment = await assessQualificationReply(state.stage, text, language);
      if (assessment.kind === 'question') {
        const result = await answer(text, language);
        state.language = result.language;
        saveConversation(chatId, state);
        await sendWithTyping(chatId, `${result.answer}${sourceList(result.sources, result.language)}`.slice(0, 4000));
        await sendWithTyping(chatId, qualificationQuestion(state.stage, result.language));
        return;
      }
      if (assessment.kind === 'invalid') {
        await sendWithTyping(chatId, qualificationQuestion(state.stage, language));
        return;
      }
      const progress = advanceQualification(state, text, language);
      saveConversation(chatId, progress.state);
      if (progress.completed) {
        await finishQualification(chatId, progress.state);
        await sendWithTyping(chatId, `${progress.acknowledgement} ${t(language, 'completed')}`.trim());
      } else {
        await sendWithTyping(chatId, humanizedProgress(progress));
      }
      return;
    }

    await telegram('sendChatAction', { chat_id: chatId, action: 'typing' });
    const result = await answer(text, language);
    state.language = result.language;
    const firstReply = needsGreeting(state, result.answer) ? `${t(result.language, 'greeting')} ${result.answer}` : result.answer;
    state.greeted = true;
    if (state.stage === STAGES.NEW) state.stage = STAGES.SEGMENT;
    saveConversation(chatId, state);
    await sendWithTyping(chatId, `${firstReply}${sourceList(result.sources, result.language)}`.slice(0, 4000));
    await sendWithTyping(chatId, qualificationQuestion(STAGES.SEGMENT, result.language));
  } catch (error) {
    console.error(`Falha ao responder no Telegram (${error?.name || 'Error'}).`);
    recordEvent('response_error', { chatFingerprint: identifierFingerprint(chatId), errorType: error?.name || 'Error' });
    await telegram('sendMessage', {
      chat_id: chatId,
      text: t(language, 'temporaryError'),
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
