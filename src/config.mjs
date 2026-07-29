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
  maxQuestionChars: Number(process.env.MAX_QUESTION_CHARS || '800'),
  maxContextChars: Number(process.env.MAX_CONTEXT_CHARS || '12000'),
  maxAnswerChars: Number(process.env.MAX_ANSWER_CHARS || '1400'),
  preferredAnswerChars: Number(process.env.PREFERRED_ANSWER_CHARS || '700'),
  conversationStatePath: resolve(projectRoot, '.state/conversations.json'),
  telegramRateLimitMaxRequests: Number(process.env.TELEGRAM_RATE_LIMIT_MAX_REQUESTS || '8'),
  telegramRateLimitWindowMs: Number(process.env.TELEGRAM_RATE_LIMIT_WINDOW_MS || '60000'),
  showSources: (process.env.SHOW_SOURCES || 'false').toLocaleLowerCase() === 'true',
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  allowedChatIds: new Set(
    (process.env.TELEGRAM_ALLOWED_CHAT_IDS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  ),
};
