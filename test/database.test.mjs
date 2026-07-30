import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migration = readFileSync(resolve(root, 'db/migrations/001_conversation_storage.sql'), 'utf8');
const cloudSqlCompose = readFileSync(resolve(root, 'docker-compose.cloudsql.yml'), 'utf8');

test('migration operacional é aditiva e usa somente tabelas do chatbot', () => {
  const tables = [...migration.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_]+)/gi)]
    .map((match) => match[1]);
  assert.deepEqual(tables, [
    'chatbot_conversations',
    'chatbot_messages',
    'chatbot_leads',
    'chatbot_handoffs',
  ]);
  assert.doesNotMatch(migration, /\b(DROP|TRUNCATE|DELETE\s+FROM|ALTER\s+TABLE)\b/i);
});

test('deployment reutiliza o proxy interno sem publicar a porta do banco', () => {
  assert.match(cloudSqlCompose, /DATABASE_HOST: cloudsql-proxy-pool/);
  assert.match(cloudSqlCompose, /external: true/);
  assert.match(cloudSqlCompose, /name: sacf-net/);
  assert.doesNotMatch(cloudSqlCompose, /credentials-file|service-account\.json/);
  assert.doesNotMatch(cloudSqlCompose, /^\s*ports:/m);
  assert.doesNotMatch(cloudSqlCompose, /CLOUDSQL_DB_PASSWORD:\s*["']?[^${\s]/);
});
