import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { database, closeDatabase } from './database.mjs';
import { assertSecureMonitoringConfig } from './config.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const directory = resolve(root, 'db/migrations');

export async function migrateMonitoringDatabase() {
  assertSecureMonitoringConfig();
  const client = await database().connect();
  try {
    await client.query('CREATE TABLE IF NOT EXISTS chatbot_schema_migrations (migration_name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const files = (await readdir(directory)).filter((file) => /^\d+.*\.sql$/.test(file)).sort();
    for (const file of files) {
      const applied = await client.query('SELECT 1 FROM chatbot_schema_migrations WHERE migration_name = $1', [file]);
      if (applied.rowCount) continue;
      await client.query('BEGIN');
      try {
        await client.query(await readFile(resolve(directory, file), 'utf8'));
        await client.query('INSERT INTO chatbot_schema_migrations (migration_name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  migrateMonitoringDatabase()
    .then(() => console.log('Migrations do painel aplicadas.'))
    .finally(() => closeDatabase());
}
