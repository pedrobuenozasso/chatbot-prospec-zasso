import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { config, projectRoot } from './config.mjs';
import { conversationStorageKey } from './conversation.mjs';
import { qualifiedLeadSummary } from './handoff.mjs';

const { Pool } = pg;
const migrationsDirectory = resolve(projectRoot, 'db/migrations');

let pool;
let ready = false;
let lastError = null;

function fingerprint(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function connectionConfiguration() {
  const missing = [
    ['DATABASE_NAME/CLOUDSQL_DB_NAME', config.databaseName],
    ['DATABASE_USER/CLOUDSQL_DB_USER', config.databaseUser],
    ['DATABASE_PASSWORD/CLOUDSQL_DB_PASSWORD', config.databasePassword],
  ].filter(([, value]) => !value);
  if (missing.length) {
    throw new Error(`Configuração do PostgreSQL incompleta: ${missing.map(([name]) => name).join(', ')}.`);
  }
  if (!Number.isInteger(config.databasePort) || config.databasePort < 1 || config.databasePort > 65535) {
    throw new Error('DATABASE_PORT inválida.');
  }
  if (!Number.isInteger(config.databasePoolMax) || config.databasePoolMax < 1 || config.databasePoolMax > 20) {
    throw new Error('DATABASE_POOL_MAX deve estar entre 1 e 20.');
  }
  if (!['disable', 'require'].includes(config.databaseSslMode)) {
    throw new Error('DATABASE_SSL_MODE deve ser disable (Cloud SQL Auth Proxy) ou require.');
  }

  return {
    host: config.databaseHost,
    port: config.databasePort,
    database: config.databaseName,
    user: config.databaseUser,
    password: config.databasePassword,
    max: config.databasePoolMax,
    connectionTimeoutMillis: config.databaseConnectTimeoutMs,
    idleTimeoutMillis: 30_000,
    application_name: 'zasso-chatbot',
    options: `-c search_path=${config.databaseSchema}`,
    ssl: config.databaseSslMode === 'require' ? { rejectUnauthorized: true } : false,
  };
}

async function runMigrations(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS chatbot_schema_migrations (
      migration_name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const migrations = readdirSync(migrationsDirectory)
    .filter((file) => /^\d+.*\.sql$/.test(file))
    .sort();

  for (const migration of migrations) {
    const alreadyApplied = await client.query(
      'SELECT 1 FROM chatbot_schema_migrations WHERE migration_name = $1',
      [migration],
    );
    if (alreadyApplied.rowCount) continue;

    const sql = readFileSync(resolve(migrationsDirectory, migration), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query(
        'INSERT INTO chatbot_schema_migrations (migration_name) VALUES ($1)',
        [migration],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
}

export function databaseStatus() {
  return {
    enabled: config.databaseEnabled,
    ready,
    required: config.databaseRequired,
    error: lastError?.name || null,
  };
}

export async function initializeDatabase() {
  if (!config.databaseEnabled) return databaseStatus();
  if (ready) return databaseStatus();

  try {
    pool ||= new Pool(connectionConfiguration());
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      await runMigrations(client);
    } finally {
      client.release();
    }
    ready = true;
    lastError = null;
  } catch (error) {
    lastError = error;
    ready = false;
    await pool?.end().catch(() => undefined);
    pool = undefined;
    if (config.databaseRequired) throw error;
    console.error(`PostgreSQL indisponível; mantendo fallback local (${error?.name || 'Error'}).`);
  }
  return databaseStatus();
}

export async function closeDatabase() {
  ready = false;
  await pool?.end();
  pool = undefined;
}

export async function enforceRetentionPolicy() {
  if (!ready) return { enabled: false, deletedMessages: 0, expiredConversations: 0 };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const deletedMessages = await client.query(
      `DELETE FROM chatbot_messages
       WHERE created_at < now() - ($1 * interval '1 day')`,
      [config.messageRetentionDays],
    );
    // O resumo comercial já foi gravado em chatbot_handoffs. Apagamos do
    // estado conversacional o nome, interesse e qualificação antigos, sem
    // remover o registro operacional que a equipe comercial possa precisar.
    const expiredConversations = await client.query(
      `UPDATE chatbot_conversations
       SET stage = 'new',
           status = 'expired',
           state = jsonb_build_object(
             'stage', 'new',
             'greeted', false,
             'language', language,
             'handoffStatus', 'not_ready',
             'initialInterest', '',
             'contact', jsonb_build_object('firstName', ''),
             'qualification', jsonb_build_object(
               'segment', null, 'region', null, 'crop', null,
               'area', null, 'areaHectares', null, 'urbanProfile', null
             ),
             'createdAt', now()::text,
             'updatedAt', now()::text
           ),
           updated_at = now()
       WHERE updated_at < now() - ($1 * interval '1 day')
         AND status <> 'expired'`,
      [config.conversationInactivityDays],
    );
    await client.query('COMMIT');
    return {
      enabled: true,
      deletedMessages: deletedMessages.rowCount || 0,
      expiredConversations: expiredConversations.rowCount || 0,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function loadConversationState(conversationId) {
  if (!ready) return null;
  const result = await pool.query(
    'SELECT state FROM chatbot_conversations WHERE conversation_key = $1',
    [conversationStorageKey(conversationId)],
  );
  return result.rows[0]?.state || null;
}

function statusFor(state) {
  return state.stage === 'completed' ? 'qualified' : 'active';
}

async function upsertConversation(client, conversationId, state, channel) {
  const key = conversationStorageKey(conversationId);
  await client.query(
    `INSERT INTO chatbot_conversations
      (conversation_key, channel, stage, status, language, state, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, COALESCE($7::timestamptz, now()), COALESCE($8::timestamptz, now()))
     ON CONFLICT (conversation_key) DO UPDATE SET
       channel = EXCLUDED.channel,
       stage = EXCLUDED.stage,
       status = EXCLUDED.status,
       language = EXCLUDED.language,
       state = EXCLUDED.state,
       updated_at = EXCLUDED.updated_at`,
    [
      key,
      channel,
      state.stage,
      statusFor(state),
      state.language || 'pt-BR',
      JSON.stringify(state),
      state.createdAt || null,
      state.updatedAt || null,
    ],
  );
  return key;
}

async function upsertLead(client, key, state, qualified) {
  const qualification = state.qualification || {};
  await client.query(
    `INSERT INTO chatbot_leads
      (conversation_key, contact_name, segment, region, crop_or_application, area_text,
       area_hectares, urban_profile, qualification, qualified_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, CASE WHEN $10 THEN now() ELSE NULL END, now())
     ON CONFLICT (conversation_key) DO UPDATE SET
       contact_name = EXCLUDED.contact_name,
       segment = EXCLUDED.segment,
       region = EXCLUDED.region,
       crop_or_application = EXCLUDED.crop_or_application,
       area_text = EXCLUDED.area_text,
       area_hectares = EXCLUDED.area_hectares,
       urban_profile = EXCLUDED.urban_profile,
       qualification = EXCLUDED.qualification,
       qualified_at = COALESCE(chatbot_leads.qualified_at, EXCLUDED.qualified_at),
       updated_at = now()`,
    [
      key,
      state.contact?.firstName || null,
      qualification.segment,
      qualification.region,
      qualification.crop,
      qualification.area,
      qualification.areaHectares,
      qualification.urbanProfile,
      JSON.stringify(qualification),
      qualified,
    ],
  );
}

function handoffText(summary) {
  return [
    `Protocolo: ${summary.protocol}`,
    `Segmento: ${summary.segment}`,
    `Região: ${summary.region || 'Não informada'}`,
    summary.cropOrApplication ? `Cultivo/aplicação: ${summary.cropOrApplication}` : null,
    summary.area ? `Área: ${summary.area}` : null,
    summary.urbanProfile ? `Perfil urbano: ${summary.urbanProfile}` : null,
    summary.interest ? `Interesse inicial: ${summary.interest}` : null,
  ].filter(Boolean).join('\n');
}

async function upsertHandoff(client, key, state) {
  if (!state.handoffProtocol) return;
  const summary = qualifiedLeadSummary(state);
  await client.query(
    `INSERT INTO chatbot_handoffs
      (protocol, conversation_key, status, summary, summary_text, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, now())
     ON CONFLICT (protocol) DO UPDATE SET
       status = EXCLUDED.status,
       summary = EXCLUDED.summary,
       summary_text = EXCLUDED.summary_text,
       updated_at = now()`,
    [
      state.handoffProtocol,
      key,
      state.handoffStatus || 'queued',
      JSON.stringify(summary),
      handoffText(summary),
    ],
  );
}

async function insertMessage(client, key, messageId, direction, content, language, metadata) {
  await client.query(
    `INSERT INTO chatbot_messages
      (conversation_key, provider_message_fingerprint, direction, content, language, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (conversation_key, provider_message_fingerprint, direction) DO NOTHING`,
    [key, fingerprint(messageId), direction, content, language, JSON.stringify(metadata)],
  );
}

export async function persistConversationState(conversationId, state, channel = 'whatsapp') {
  if (!ready) return false;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const key = await upsertConversation(client, conversationId, state, channel);
    await upsertLead(client, key, state, state.stage === 'completed');
    await upsertHandoff(client, key, state);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function persistInteraction(payload, result, state) {
  if (!ready) return false;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const key = await upsertConversation(client, payload.conversationId, state, payload.channel || 'whatsapp');
    await upsertLead(client, key, state, result.qualified || state.stage === 'completed');
    await upsertHandoff(client, key, state);
    await insertMessage(
      client,
      key,
      `${payload.messageId}:inbound`,
      'inbound',
      payload.text,
      state.language,
      { stageAfter: result.stage, duplicate: result.duplicate },
    );
    for (const [index, message] of result.messages.entries()) {
      const sources = (Array.isArray(result.sources) ? result.sources : [])
        .map((source) => source?.faqId)
        .filter(Boolean)
        .slice(0, 10);
      await insertMessage(
        client,
        key,
        `${payload.messageId}:outbound:${index}`,
        'outbound',
        message,
        result.language,
        {
          stage: result.stage,
          handoffStatus: result.handoffStatus,
          sources,
          answerMode: result.answerMode || null,
        },
      );
    }
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
