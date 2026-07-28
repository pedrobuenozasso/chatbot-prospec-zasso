import { config } from './config.mjs';
import { answer } from './rag.mjs';

const telegramApi = `https://api.telegram.org/bot${config.telegramToken}`;

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

function canUse(chatId) {
  return config.allowedChatIds.size === 0 || config.allowedChatIds.has(String(chatId));
}

function sourceList(sources) {
  if (!sources.length) return '';
  return `\n\nFontes consultadas:\n${sources.map((source) => `• ${source.faqId}`).join('\n')}`;
}

async function respond(message) {
  const chatId = message.chat.id;
  const text = message.text?.trim() || '';
  console.log(`Mensagem recebida do chat ${chatId}.`);
  if (!canUse(chatId)) {
    console.warn(`Acesso recusado ao chat ${chatId}. Inclua-o em TELEGRAM_ALLOWED_CHAT_IDS para liberar.`);
    return;
  }

  if (text === '/start' || text === '/help') {
    await telegram('sendMessage', {
      chat_id: chatId,
      text: 'Olá! Posso responder perguntas sobre a Zasso com base nas FAQs comerciais aprovadas. Faça uma pergunta como: “O que é a Zasso?”',
    });
    return;
  }
  if (!text) return;

  try {
    const result = await answer(text);
    await telegram('sendMessage', {
      chat_id: chatId,
      text: `${result.answer}${sourceList(result.sources)}`.slice(0, 4000),
    });
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
