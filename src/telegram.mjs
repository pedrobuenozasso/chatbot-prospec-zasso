import { config } from './config.mjs';
import { advanceQualification, getConversation, qualificationQuestion, saveConversation, STAGES } from './conversation.mjs';
import { queueQualifiedLead } from './handoff.mjs';
import { identifierFingerprint, recordEvent } from './observability.mjs';
import { typingDelayFor } from './pacing.mjs';
import { answer, assessQualificationReply } from './rag.mjs';

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

function sourceList(sources) {
  if (!config.showSources || !sources.length) return '';
  return `\n\nReferências internas: ${sources.map((source) => source.faqId).join(', ')}`;
}

const welcomeText = `Olá! Eu sou o assistente da Zasso. Posso te ajudar com dúvidas sobre a tecnologia Electroherb, aplicações, segurança e produtos.

Por exemplo: “Como a capina elétrica funciona?”`;

const examplesText = `Alguns assuntos sobre os quais posso ajudar:

• O que é a Zasso?
• Como a capina elétrica funciona?
• Quais são os principais produtos da Zasso?
• A tecnologia funciona em plantas adultas?
• É perigoso trabalhar com alta tensão?
• A Zasso afeta a biodiversidade?`;

function needsGreeting(state, answerText) {
  return !state.greeted && !/^(olá|oi|bom dia|boa tarde|boa noite)/i.test(answerText);
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
  const state = getConversation(chatId, { firstName: message.from?.first_name, username: message.from?.username });
  console.log(`Mensagem recebida do chat ${identifierFingerprint(chatId)}.`);
  if (!canUse(chatId)) {
    recordEvent('access_denied', { chatFingerprint: identifierFingerprint(chatId) });
    console.warn(`Acesso recusado ao chat ${identifierFingerprint(chatId)}.`);
    return;
  }

  if (text === '/start' || text === '/help') {
    await telegram('sendMessage', {
      chat_id: chatId,
      text: welcomeText,
    });
    return;
  }
  if (text === '/examples') {
    await telegram('sendMessage', { chat_id: chatId, text: examplesText });
    return;
  }
  if (!text) {
    await telegram('sendMessage', { chat_id: chatId, text: 'Por enquanto, consigo te ajudar por mensagem de texto.' });
    return;
  }
  if (!withinRateLimit(chatId)) {
    recordEvent('rate_limited', { chatFingerprint: identifierFingerprint(chatId) });
    await telegram('sendMessage', { chat_id: chatId, text: 'Recebi muitas mensagens em sequência. Aguarde um minuto e tente novamente.' });
    return;
  }

  try {
    if (state.stage !== STAGES.NEW && state.stage !== STAGES.COMPLETED) {
      await telegram('sendChatAction', { chat_id: chatId, action: 'typing' });
      const assessment = await assessQualificationReply(state.stage, text);
      if (assessment.kind === 'question') {
        const result = await answer(text);
        await sendWithTyping(chatId, `${result.answer}${sourceList(result.sources)}`.slice(0, 4000));
        await sendWithTyping(chatId, qualificationQuestion(state.stage));
        return;
      }
      if (assessment.kind === 'invalid') {
        await sendWithTyping(chatId, qualificationQuestion(state.stage));
        return;
      }
      const progress = advanceQualification(state, text);
      saveConversation(chatId, progress.state);
      if (progress.completed) {
        await finishQualification(chatId, progress.state);
        await sendWithTyping(chatId, 'Obrigado pelas informações. Já organizei os dados para que o time responsável possa dar continuidade ao atendimento.');
      } else {
        await sendWithTyping(chatId, progress.nextQuestion);
      }
      return;
    }

    await telegram('sendChatAction', { chat_id: chatId, action: 'typing' });
    const result = await answer(text);
    const firstReply = needsGreeting(state, result.answer) ? `Olá! ${result.answer}` : result.answer;
    state.greeted = true;
    if (state.stage === STAGES.NEW) state.stage = STAGES.SEGMENT;
    saveConversation(chatId, state);
    await sendWithTyping(chatId, `${firstReply}${sourceList(result.sources)}`.slice(0, 4000));
    await sendWithTyping(chatId, qualificationQuestion(STAGES.SEGMENT));
  } catch (error) {
    console.error(error);
    await telegram('sendMessage', {
      chat_id: chatId,
      text: 'Não consegui consultar a base agora. Tente novamente em alguns instantes.',
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
