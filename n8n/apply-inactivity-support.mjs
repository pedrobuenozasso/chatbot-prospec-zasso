import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { publicApiPayload } from './apply-commercial-cta.mjs';

const originalMessageParsing = `const message = data.message ?? {};
const unwrapped = message.ephemeralMessage?.message ?? message.viewOnceMessage?.message ?? message;
const text = String(
  unwrapped.conversation ??
  unwrapped.extendedTextMessage?.text ??
  unwrapped.imageMessage?.caption ??
  unwrapped.videoMessage?.caption ??
  ''
).trim();
if (!text || !key.id) return [];`;

const inactivityMessageParsing = `const message = data.message ?? {};
const unwrapped = message.ephemeralMessage?.message ?? message.viewOnceMessage?.message ?? message;
let nativeReply = {};
try {
  nativeReply = JSON.parse(unwrapped.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ?? '{}');
} catch {
  nativeReply = {};
}
const interactionId = String(
  unwrapped.buttonsResponseMessage?.selectedButtonId ??
  unwrapped.templateButtonReplyMessage?.selectedId ??
  nativeReply.id ??
  ''
).trim();
const interactionTitle = String(
  unwrapped.buttonsResponseMessage?.selectedDisplayText ??
  unwrapped.templateButtonReplyMessage?.selectedDisplayText ??
  nativeReply.title ??
  ''
).trim();
const isInactivityAction = /^zasso_inactivity:(?:continue|close):\\d{1,19}$/.test(interactionId);
const text = String(
  isInactivityAction ? interactionTitle : (
    unwrapped.conversation ??
    unwrapped.extendedTextMessage?.text ??
    unwrapped.imageMessage?.caption ??
    unwrapped.videoMessage?.caption ??
    ''
  )
).trim();
if ((!text && !isInactivityAction) || !key.id) return [];`;

function requiredNode(workflow, name) {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  if (!node) throw new Error(`Node obrigatório ausente: ${name}`);
  return node;
}

export function applyInactivitySupport(workflow) {
  const updated = structuredClone(workflow);
  const normalizer = requiredNode(updated, 'Normalizar e Filtrar Evento');
  const chatbot = requiredNode(updated, 'Consultar Chatbot Zasso');
  let code = String(normalizer.parameters.jsCode || '');

  if (!code.includes('isInactivityAction')) {
    if (!code.includes(originalMessageParsing)) {
      throw new Error('Bloco de normalização de mensagens não reconhecido; nenhuma alteração foi aplicada.');
    }
    code = code
      .replace(originalMessageParsing, inactivityMessageParsing)
      .replace("    eventType: 'message',", "    eventType: isInactivityAction ? 'interactive' : 'message',")
      .replace('    text\n  }\n}];', "    text,\n    ...(isInactivityAction ? { interactionId } : {})\n  }\n}];");
  }
  if (!code.includes("eventType: isInactivityAction ? 'interactive' : 'message'")) {
    throw new Error('O normalizador não encaminha a interação como evento interativo.');
  }
  normalizer.parameters.jsCode = code;

  const body = String(chatbot.parameters.body || '');
  if (!body.includes('interactionId: $json.interactionId')) {
    const marker = 'text: $json.text, recipientNumber: $json.number';
    if (!body.includes(marker)) {
      throw new Error('Contrato do node do chatbot não reconhecido; nenhuma alteração foi aplicada.');
    }
    chatbot.parameters.body = body.replace(
      marker,
      'text: $json.text, interactionId: $json.interactionId, recipientNumber: $json.number',
    );
  }
  return updated;
}

async function main() {
  const source = readFileSync(0, 'utf8');
  const parsed = JSON.parse(source);
  const workflow = Array.isArray(parsed) ? parsed[0] : parsed;
  process.stdout.write(JSON.stringify(publicApiPayload(applyInactivitySupport(workflow))));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
