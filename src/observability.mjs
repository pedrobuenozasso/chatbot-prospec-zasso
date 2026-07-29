import { appendFileSync, chmodSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { config } from './config.mjs';

const eventsPath = `${dirname(config.indexPath)}/../.logs/events.jsonl`;

function fingerprint(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

export function recordEvent(kind, details = {}) {
  mkdirSync(dirname(eventsPath), { recursive: true, mode: 0o700 });
  appendFileSync(eventsPath, `${JSON.stringify({
    timestamp: new Date().toISOString(),
    kind,
    ...details,
  })}\n`, { mode: 0o600 });
  chmodSync(eventsPath, 0o600);
}

export function questionFingerprint(question) {
  return fingerprint(question.trim().toLocaleLowerCase('pt-BR'));
}

export function identifierFingerprint(identifier) {
  return fingerprint(identifier);
}
