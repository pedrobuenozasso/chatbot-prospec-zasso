import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { config, projectRoot } from './config.mjs';
import { conversationStorageKey } from './conversation.mjs';
import { qualifiedLeadSummary } from './handoff.mjs';
import { t } from './i18n.mjs';
import { decryptWeekendRecipient, encryptWeekendRecipient } from './weekend-crypto.mjs';

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
  if (!ready) return { enabled: false, deletedMessages: 0, expiredConversations: 0, deletedInactivityReminders: 0 };
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
    const deletedInactivityReminders = await client.query(
      `DELETE FROM chatbot_inactivity_reminders
       WHERE status NOT IN ('queued', 'sending', 'sent')
         AND updated_at < now() - ($1 * interval '1 day')`,
      [config.messageRetentionDays],
    );
    await client.query('COMMIT');
    return {
      enabled: true,
      deletedMessages: deletedMessages.rowCount || 0,
      expiredConversations: expiredConversations.rowCount || 0,
      deletedInactivityReminders: deletedInactivityReminders.rowCount || 0,
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
  if (state.stage === 'closed') {
    return state.closureReason === 'inactivity_no_response' ? 'inactive_lost' : 'closed_by_lead';
  }
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

async function upsertWeekendHandoff(client, key, payload, state) {
  if (state.handoffStatus !== 'weekend_queued' || !state.handoffProtocol) return;
  const schedule = state.weekendHandoff || {};
  if (!payload.recipientNumber) throw new Error('Destinatário ausente para a fila de fim de semana.');
  if (!['ctwa_marker', 'ctwa_referral'].includes(schedule.sourceType)) {
    throw new Error('Origem inelegível para a fila de fim de semana.');
  }

  await client.query(
    `INSERT INTO chatbot_weekend_handoffs
      (protocol, conversation_key, recipient_ciphertext, language, source_type,
       first_inbound_at, free_entry_expires_at, scheduled_for, status, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8::timestamptz, 'queued', now())
     ON CONFLICT (protocol) DO UPDATE SET
       recipient_ciphertext = CASE
         WHEN chatbot_weekend_handoffs.status = 'queued' THEN EXCLUDED.recipient_ciphertext
         ELSE chatbot_weekend_handoffs.recipient_ciphertext
       END,
       language = EXCLUDED.language,
       updated_at = now()`,
    [
      state.handoffProtocol,
      key,
      encryptWeekendRecipient(payload.recipientNumber),
      state.language || 'pt-BR',
      schedule.sourceType,
      schedule.firstInboundAt,
      schedule.freeEntryExpiresAt,
      schedule.scheduledFor,
    ],
  );
}

async function cancelPendingWeekendHandoffs(client, key, reason) {
  await client.query(
    `UPDATE chatbot_weekend_handoffs
     SET status = 'cancelled', last_error_code = $2, updated_at = now()
     WHERE conversation_key = $1 AND status IN ('queued', 'sending')`,
    [key, reason],
  );
}

async function cancelOpenInactivityReminders(client, key, reason) {
  await client.query(
    `UPDATE chatbot_inactivity_reminders
     SET status = 'cancelled', recipient_ciphertext = '', last_error_code = $2, updated_at = now()
     WHERE conversation_key = $1 AND status IN ('queued', 'sending', 'sent')`,
    [key, reason],
  );
}

function shouldScheduleInactivityReminder(payload, result, state) {
  return config.inactivityReminderEnabled
    && payload.channel === 'whatsapp'
    && Boolean(payload.recipientNumber)
    && payload.eventType !== 'call'
    && !result.duplicate
    && !result.reset
    && Array.isArray(result.messages)
    && result.messages.length > 0
    && ['segment', 'region', 'agro_crop', 'agro_area', 'urban_profile'].includes(state.stage);
}

async function scheduleInactivityReminder(client, key, payload, state) {
  await client.query(
    `INSERT INTO chatbot_inactivity_reminders
      (conversation_key, recipient_ciphertext, language, pending_stage, scheduled_for, status, updated_at)
     VALUES ($1, $2, $3, $4, now() + ($5 * interval '1 minute'), 'queued', now())`,
    [
      key,
      encryptWeekendRecipient(payload.recipientNumber),
      state.language || 'pt-BR',
      state.stage,
      config.inactivityReminderMinutes,
    ],
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
    if (result.inactivityDecision !== 'stale') {
      await cancelOpenInactivityReminders(
        client,
        key,
        result.inactivityDecision ? `lead_${result.inactivityDecision}` : 'lead_replied',
      );
    }
    await upsertLead(client, key, state, result.qualified || state.stage === 'completed');
    await upsertHandoff(client, key, state);
    await upsertWeekendHandoff(client, key, payload, state);
    if (result.reset || state.handoffStatus === 'weekend_cancelled') {
      await cancelPendingWeekendHandoffs(client, key, result.reset ? 'conversation_reset' : 'lead_opt_out');
    }
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
    if (shouldScheduleInactivityReminder(payload, result, state)) {
      await scheduleInactivityReminder(client, key, payload, state);
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

export async function acceptInactivityDecision({ conversationId, reminderId, decision }) {
  if (!ready) throw new Error('PostgreSQL indisponível para confirmar o lembrete de inatividade.');
  if (!['continue', 'close'].includes(decision)) return false;
  if (!/^\d{1,19}$/.test(String(reminderId || ''))) return false;
  const result = await pool.query(
    `UPDATE chatbot_inactivity_reminders
     SET status = $3::text,
         recipient_ciphertext = '',
         responded_at = now(),
         updated_at = now()
     WHERE id = $1::bigint
       AND conversation_key = $2
       AND status = 'sent'
     RETURNING id`,
    [
      String(reminderId),
      conversationStorageKey(conversationId),
      decision === 'continue' ? 'continued' : 'closed',
    ],
  );
  return result.rowCount === 1;
}

async function expireSilentInactivityReminders(client) {
  const expired = await client.query(
    `UPDATE chatbot_inactivity_reminders
     SET status = 'expired', recipient_ciphertext = '', last_error_code = 'no_response', updated_at = now()
     WHERE status IN ('queued', 'sent')
       AND scheduled_for <= now() - ($1 * interval '1 hour')
     RETURNING conversation_key`,
    [config.inactivityAutoCloseHours],
  );
  const keys = [...new Set(expired.rows.map((row) => row.conversation_key))];
  if (!keys.length) return 0;
  await client.query(
    `UPDATE chatbot_conversations
     SET stage = 'closed',
         status = 'inactive_lost',
         state = jsonb_set(
           jsonb_set(
             jsonb_set(state, '{stage}', to_jsonb('closed'::text), true),
             '{closureReason}', to_jsonb('inactivity_no_response'::text), true
           ),
           '{closedAt}', to_jsonb(now()::text), true
         ),
         updated_at = now()
     WHERE conversation_key = ANY($1::char(64)[])
       AND stage NOT IN ('completed', 'closed')`,
    [keys],
  );
  return keys.length;
}

export async function claimDueInactivityReminders(limit = config.inactivityReminderClaimLimit) {
  if (!config.inactivityReminderEnabled) return [];
  if (!ready) throw new Error('PostgreSQL indisponível para a fila de inatividade.');
  const requested = Math.min(Math.max(Number(limit) || 1, 1), config.inactivityReminderClaimLimit);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE chatbot_inactivity_reminders
       SET status = 'failed', recipient_ciphertext = '', last_error_code = 'claim_timeout_manual_review', updated_at = now()
       WHERE status = 'sending'
         AND claimed_at <= now() - interval '20 minutes'`,
    );
    await expireSilentInactivityReminders(client);
    const selected = await client.query(
      `SELECT id, recipient_ciphertext, language, pending_stage, scheduled_for
       FROM chatbot_inactivity_reminders
       WHERE status = 'queued' AND scheduled_for <= now()
       ORDER BY scheduled_for, id
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [requested],
    );
    const ids = selected.rows.map((row) => row.id);
    if (ids.length) {
      await client.query(
        `UPDATE chatbot_inactivity_reminders
         SET status = 'sending', attempts = attempts + 1, claimed_at = now(), updated_at = now()
         WHERE id = ANY($1::bigint[])`,
        [ids],
      );
    }
    await client.query('COMMIT');
    return selected.rows.map((row) => ({
      reminderId: String(row.id),
      recipientNumber: decryptWeekendRecipient(row.recipient_ciphertext),
      language: row.language,
      pendingStage: row.pending_stage,
      scheduledFor: row.scheduled_for,
      prompt: t(row.language, 'inactivityPrompt'),
      continueLabel: t(row.language, 'inactivityContinueButton'),
      closeLabel: t(row.language, 'inactivityCloseButton'),
      continueId: `zasso_inactivity:continue:${row.id}`,
      closeId: `zasso_inactivity:close:${row.id}`,
    }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function completeInactivityReminder({ reminderId, status, metaMessageId = '', errorCode = '' }) {
  if (!ready) throw new Error('PostgreSQL indisponível para a fila de inatividade.');
  if (!/^\d{1,19}$/.test(String(reminderId || ''))) throw new Error('Identificador de lembrete inválido.');
  if (!['sent', 'failed'].includes(status)) throw new Error('Resultado de envio inválido.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE chatbot_inactivity_reminders
       SET status = $2::text,
           recipient_ciphertext = '',
           meta_message_id = NULLIF($3, ''),
           last_error_code = NULLIF($4, ''),
           sent_at = CASE WHEN $2::text = 'sent' THEN now() ELSE sent_at END,
           updated_at = now()
       WHERE id = $1::bigint AND status = 'sending'
       RETURNING id, conversation_key, language`,
      [String(reminderId), status, String(metaMessageId).slice(0, 220), String(errorCode).slice(0, 120)],
    );
    if (result.rowCount && status === 'sent') {
      const row = result.rows[0];
      await insertMessage(
        client,
        row.conversation_key,
        `inactivity-reminder:${reminderId}:${metaMessageId || 'sent'}`,
        'outbound',
        t(row.language, 'inactivityPrompt'),
        row.language,
        { kind: 'inactivity_reminder', reminderId: String(reminderId) },
      );
    }
    await client.query('COMMIT');
    return result.rowCount === 1;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function inactivityReminderStatus() {
  if (!ready) return { enabled: false, counts: {} };
  const result = await pool.query(
    `SELECT status, count(*)::integer AS total
     FROM chatbot_inactivity_reminders GROUP BY status ORDER BY status`,
  );
  return {
    enabled: config.inactivityReminderEnabled,
    reminderMinutes: config.inactivityReminderMinutes,
    autoCloseHours: config.inactivityAutoCloseHours,
    counts: Object.fromEntries(result.rows.map((row) => [row.status, row.total])),
  };
}

export async function claimDueWeekendHandoffs(limit = config.weekendHandoffClaimLimit) {
  if (!config.weekendHandoffEnabled) return [];
  if (!ready) throw new Error('PostgreSQL indisponível para a fila de fim de semana.');
  const requested = Math.min(Math.max(Number(limit) || 1, 1), config.weekendHandoffClaimLimit);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Uma reserva abandonada indica interrupcao entre o claim e o registro do
    // resultado. Nao a reenfileiramos automaticamente: a Meta pode ter aceitado
    // a mensagem antes da queda e uma nova tentativa criaria duplicidade.
    await client.query(
      `UPDATE chatbot_weekend_handoffs
       SET status = 'failed',
           last_error_code = 'claim_timeout_manual_review',
           updated_at = now()
       WHERE status = 'sending'
         AND claimed_at <= now() - interval '20 minutes'`,
    );
    await client.query(
      `UPDATE chatbot_weekend_handoffs
       SET status = 'skipped', last_error_code = 'free_entry_expired', updated_at = now()
       WHERE status = 'queued' AND free_entry_expires_at <= now()`,
    );
    const selected = await client.query(
      `SELECT protocol, recipient_ciphertext, language, source_type,
              scheduled_for, free_entry_expires_at
       FROM chatbot_weekend_handoffs
       WHERE status = 'queued'
         AND scheduled_for <= now()
         AND free_entry_expires_at > now()
       ORDER BY scheduled_for, created_at
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [requested],
    );
    const protocols = selected.rows.map((row) => row.protocol);
    if (protocols.length) {
      await client.query(
        `UPDATE chatbot_weekend_handoffs
         SET status = 'sending', attempts = attempts + 1, claimed_at = now(), updated_at = now()
         WHERE protocol = ANY($1::varchar[])`,
        [protocols],
      );
    }
    await client.query('COMMIT');
    return selected.rows.map((row) => ({
      protocol: row.protocol,
      recipientNumber: decryptWeekendRecipient(row.recipient_ciphertext),
      language: row.language,
      sourceType: row.source_type,
      scheduledFor: row.scheduled_for,
      freeEntryExpiresAt: row.free_entry_expires_at,
      templateName: config.weekendHandoffTemplateName,
    }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function completeWeekendHandoff({ protocol, status, metaMessageId = '', errorCode = '' }) {
  if (!ready) throw new Error('PostgreSQL indisponível para a fila de fim de semana.');
  if (!/^ZAS-[A-Z0-9-]{8,32}$/i.test(protocol)) throw new Error('Protocolo inválido.');
  if (!['sent', 'failed'].includes(status)) throw new Error('Resultado de envio inválido.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE chatbot_weekend_handoffs
       SET status = $2::varchar,
           meta_message_id = NULLIF($3, ''),
           last_error_code = NULLIF($4, ''),
           sent_at = CASE WHEN $2::varchar = 'sent' THEN now() ELSE sent_at END,
           updated_at = now()
       WHERE protocol = $1 AND status = 'sending'
       RETURNING conversation_key`,
      [protocol, status, String(metaMessageId).slice(0, 220), String(errorCode).slice(0, 80)],
    );
    if (!updated.rowCount) {
      await client.query('ROLLBACK');
      return false;
    }
    const conversationKey = updated.rows[0].conversation_key;
    if (status === 'sent') {
      await client.query(
        `UPDATE chatbot_conversations
         SET state = jsonb_set(
               jsonb_set(state, '{handoffStatus}', to_jsonb('weekend_template_sent'::text), true),
               '{updatedAt}', to_jsonb(now()::text), true
             ),
             updated_at = now()
         WHERE conversation_key = $1`,
        [conversationKey],
      );
      await client.query(
        `UPDATE chatbot_handoffs SET status = 'weekend_template_sent', updated_at = now()
         WHERE protocol = $1`,
        [protocol],
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

export async function weekendHandoffStatus() {
  if (!ready) return { enabled: false, counts: {} };
  const result = await pool.query(
    `SELECT status, count(*)::integer AS total
     FROM chatbot_weekend_handoffs GROUP BY status ORDER BY status`,
  );
  return {
    enabled: config.weekendHandoffEnabled,
    releaseAt: config.weekendHandoffReleaseAt || null,
    counts: Object.fromEntries(result.rows.map((row) => [row.status, row.total])),
  };
}
