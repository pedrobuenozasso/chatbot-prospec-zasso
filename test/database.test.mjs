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

test('proxy do Cloud SQL não publica a porta do banco no host', () => {
  assert.match(cloudSqlCompose, /cloud-sql-proxy:2\.22\.0/);
  assert.match(cloudSqlCompose, /cloudsql-service-account\.json:ro/);
  assert.doesNotMatch(cloudSqlCompose, /^\s*ports:/m);
  assert.doesNotMatch(cloudSqlCompose, /CLOUDSQL_DB_PASSWORD:\s*["']?[^${\s]/);
});
