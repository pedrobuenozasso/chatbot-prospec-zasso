import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { monitoringConfig } from './config.mjs';
import { hashPassword, sha256 } from './security.mjs';

const { Pool } = pg;
let pool;

function table(name) {
  return `"${monitoringConfig.databaseSchema}"."${name}"`;
}

export function database() {
  if (!pool) {
    pool = new Pool({
      host: monitoringConfig.databaseHost,
      port: monitoringConfig.databasePort,
      database: monitoringConfig.databaseName,
      user: monitoringConfig.databaseUser,
      password: monitoringConfig.databasePassword,
      max: monitoringConfig.databasePoolMax,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      application_name: 'zasso-monitoring-panel',
    });
  }
  return pool;
}

export async function closeDatabase() {
  await pool?.end();
  pool = undefined;
}

export async function databaseHealth() {
  const startedAt = Date.now();
  const result = await database().query('SELECT now() AS now');
  return { ok: true, latencyMs: Date.now() - startedAt, timestamp: result.rows[0].now };
}

export async function findUserByEmail(email) {
  const result = await database().query(
    `SELECT id, email, display_name, password_hash, totp_secret_encrypted, role, active,
            failed_login_count, locked_until
       FROM ${table('chatbot_admin_users')}
      WHERE email = $1`,
    [String(email).trim().toLowerCase()],
  );
  return result.rows[0] || null;
}

export async function findUserById(id) {
  const result = await database().query(
    `SELECT id, email, display_name, role, active, last_login_at, created_at
       FROM ${table('chatbot_admin_users')} WHERE id = $1`,
    [id],
  );
  return result.rows[0] || null;
}

export async function createOrUpdateUser({ email, displayName, password, role, totpSecretEncrypted }) {
  const passwordHash = await hashPassword(password);
  const id = randomUUID();
  const result = await database().query(
    `INSERT INTO ${table('chatbot_admin_users')}
       (id, email, display_name, password_hash, totp_secret_encrypted, role)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (email) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       password_hash = EXCLUDED.password_hash,
       totp_secret_encrypted = EXCLUDED.totp_secret_encrypted,
       role = EXCLUDED.role,
       active = true,
       failed_login_count = 0,
       locked_until = NULL,
       updated_at = now()
     RETURNING id, email, display_name, role, active`,
    [id, email.toLowerCase(), displayName, passwordHash, totpSecretEncrypted, role],
  );
  return result.rows[0];
}

export async function recordLoginFailure(userId) {
  await database().query(
    `UPDATE ${table('chatbot_admin_users')}
        SET failed_login_count = failed_login_count + 1,
            locked_until = CASE WHEN failed_login_count + 1 >= 5
              THEN now() + interval '15 minutes' ELSE locked_until END,
            updated_at = now()
      WHERE id = $1`,
    [userId],
  );
}

export async function recordLoginSuccess(userId) {
  await database().query(
    `UPDATE ${table('chatbot_admin_users')}
        SET failed_login_count = 0, locked_until = NULL, last_login_at = now(), updated_at = now()
      WHERE id = $1`,
    [userId],
  );
}

export async function createSession({ token, csrfToken, userId, ip, userAgent }) {
  const expiresAt = new Date(Date.now() + monitoringConfig.sessionHours * 60 * 60 * 1000);
  await database().query(
    `INSERT INTO ${table('chatbot_admin_sessions')}
       (token_hash, user_id, csrf_hash, ip_fingerprint, user_agent_fingerprint, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sha256(token), userId, sha256(csrfToken), sha256(ip), sha256(userAgent), expiresAt],
  );
  return expiresAt;
}

export async function sessionUser(token) {
  if (!token) return null;
  const result = await database().query(
    `SELECT s.token_hash, s.csrf_hash, s.expires_at,
            u.id, u.email, u.display_name, u.role, u.active
       FROM ${table('chatbot_admin_sessions')} s
       JOIN ${table('chatbot_admin_users')} u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active = true`,
    [sha256(token)],
  );
  const row = result.rows[0];
  if (!row) return null;
  await database().query(
    `UPDATE ${table('chatbot_admin_sessions')} SET last_seen_at = now() WHERE token_hash = $1`,
    [row.token_hash],
  );
  return row;
}

export async function deleteSession(token) {
  if (!token) return;
  await database().query(
    `DELETE FROM ${table('chatbot_admin_sessions')} WHERE token_hash = $1`,
    [sha256(token)],
  );
}

export async function purgeExpiredSessions() {
  await database().query(`DELETE FROM ${table('chatbot_admin_sessions')} WHERE expires_at <= now()`);
}

export async function enforceMonitoringRetention() {
  await Promise.all([
    purgeExpiredSessions(),
    database().query(
      `DELETE FROM ${table('chatbot_health_snapshots')} WHERE created_at < now() - ($1 * interval '1 day')`,
      [monitoringConfig.healthRetentionDays],
    ),
    database().query(
      `DELETE FROM ${table('chatbot_admin_audit_log')} WHERE created_at < now() - ($1 * interval '1 day')`,
      [monitoringConfig.auditRetentionDays],
    ),
  ]);
}

export async function audit({ actorId = null, action, resourceType, resource = '', details = {}, ip = '' }) {
  const serializedDetails = JSON.stringify(details);
  const safeDetails = serializedDetails.length <= 4000
    ? serializedDetails
    : JSON.stringify({ truncated: true, originalBytes: Buffer.byteLength(serializedDetails) });
  await database().query(
    `INSERT INTO ${table('chatbot_admin_audit_log')}
       (actor_user_id, action, resource_type, resource_fingerprint, details, ip_fingerprint)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [actorId, action, resourceType, resource ? sha256(resource) : null, safeDetails, ip ? sha256(ip) : null],
  );
}

const fallbackSql = `(
  content ILIKE '%não encontrei uma confirmação suficiente%'
  OR content ILIKE '%preciso entender um pouco mais%'
  OR content ILIKE '%could not find enough confirmed%'
  OR content ILIKE '%keine ausreichend bestätigte%'
  OR content ILIKE '%pas trouvé suffisamment%'
  OR content ILIKE '%no encontré suficiente información%'
)`;

export async function overview() {
  const [counts, segment, languages, status, recentHealth] = await Promise.all([
    database().query(
      `SELECT
         (SELECT count(*)::int FROM ${table('chatbot_conversations')} WHERE created_at >= now() - interval '24 hours') AS conversations_24h,
         (SELECT count(*)::int FROM ${table('chatbot_messages')} WHERE created_at >= now() - interval '24 hours') AS messages_24h,
         (SELECT count(*)::int FROM ${table('chatbot_leads')} WHERE qualified_at >= now() - interval '7 days') AS qualified_7d,
         (SELECT count(*)::int FROM ${table('chatbot_messages')} WHERE direction = 'outbound' AND created_at >= now() - interval '7 days' AND ${fallbackSql}) AS fallbacks_7d,
         (SELECT count(*)::int FROM ${table('chatbot_conversations')} WHERE status = 'active' AND updated_at >= now() - interval '24 hours') AS active_now,
         (SELECT count(*)::int FROM ${table('chatbot_conversation_reviews')} WHERE status = 'needs_action') AS needs_action`,
    ),
    database().query(
      `SELECT COALESCE(segment, 'não informado') AS label, count(*)::int AS value
         FROM ${table('chatbot_leads')} WHERE updated_at >= now() - interval '30 days'
        GROUP BY 1 ORDER BY value DESC`,
    ),
    database().query(
      `SELECT language AS label, count(*)::int AS value
         FROM ${table('chatbot_conversations')} WHERE updated_at >= now() - interval '30 days'
        GROUP BY language ORDER BY value DESC`,
    ),
    database().query(
      `SELECT status AS label, count(*)::int AS value
         FROM ${table('chatbot_conversations')} WHERE updated_at >= now() - interval '30 days'
        GROUP BY status ORDER BY value DESC`,
    ),
    database().query(
      `SELECT overall_status, components, response_time_ms, created_at
         FROM ${table('chatbot_health_snapshots')} ORDER BY created_at DESC LIMIT 1`,
    ),
  ]);
  return {
    counts: counts.rows[0],
    segments: segment.rows,
    languages: languages.rows,
    statuses: status.rows,
    lastHealth: recentHealth.rows[0] || null,
  };
}

export async function listConversations({ page = 1, limit = 30, status = '', segment = '', search = '' }) {
  const offset = (page - 1) * limit;
  const values = [];
  const filters = [];
  if (status) { values.push(status); filters.push(`c.status = $${values.length}`); }
  if (segment) { values.push(segment); filters.push(`l.segment = $${values.length}`); }
  if (search) {
    values.push(`%${search}%`);
    filters.push(`(h.protocol ILIKE $${values.length} OR l.contact_name ILIKE $${values.length} OR l.region ILIKE $${values.length})`);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  values.push(limit, offset);
  const result = await database().query(
    `SELECT c.conversation_key AS id, c.channel, c.stage, c.status, c.language,
            c.created_at, c.updated_at, l.contact_name, l.segment, l.region,
            l.crop_or_application, l.area_text, l.urban_profile, l.qualified_at,
            h.protocol, h.status AS handoff_status,
            COALESCE((SELECT count(*) FROM ${table('chatbot_messages')} m WHERE m.conversation_key = c.conversation_key), 0)::int AS message_count,
            COALESCE((SELECT status FROM ${table('chatbot_conversation_reviews')} r WHERE r.conversation_key = c.conversation_key ORDER BY updated_at DESC LIMIT 1), 'pending') AS review_status,
            count(*) OVER()::int AS total
       FROM ${table('chatbot_conversations')} c
       LEFT JOIN ${table('chatbot_leads')} l ON l.conversation_key = c.conversation_key
       LEFT JOIN LATERAL (
         SELECT protocol, status FROM ${table('chatbot_handoffs')} h2
          WHERE h2.conversation_key = c.conversation_key ORDER BY created_at DESC LIMIT 1
       ) h ON true
       ${where}
      ORDER BY c.updated_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return { items: result.rows.map(({ total, ...row }) => row), total: result.rows[0]?.total || 0, page, limit };
}

export async function conversationDetail(id) {
  const [conversation, messages, reviews] = await Promise.all([
    database().query(
      `SELECT c.conversation_key AS id, c.channel, c.stage, c.status, c.language,
              c.created_at, c.updated_at, l.contact_name, l.segment, l.region,
              l.crop_or_application, l.area_text, l.area_hectares, l.urban_profile,
              l.qualification, l.qualified_at, h.protocol, h.status AS handoff_status,
              h.summary, h.created_at AS handoff_created_at
         FROM ${table('chatbot_conversations')} c
         LEFT JOIN ${table('chatbot_leads')} l ON l.conversation_key = c.conversation_key
         LEFT JOIN LATERAL (
           SELECT * FROM ${table('chatbot_handoffs')} h2
            WHERE h2.conversation_key = c.conversation_key ORDER BY created_at DESC LIMIT 1
         ) h ON true
        WHERE c.conversation_key = $1`,
      [id],
    ),
    database().query(
      `SELECT id, direction, content, language, metadata, created_at
         FROM ${table('chatbot_messages')}
        WHERE conversation_key = $1 ORDER BY created_at, id`,
      [id],
    ),
    database().query(
      `SELECT r.id, r.rating, r.labels, r.notes, r.status, r.created_at, r.updated_at,
              u.display_name AS reviewer_name
         FROM ${table('chatbot_conversation_reviews')} r
         LEFT JOIN ${table('chatbot_admin_users')} u ON u.id = r.reviewer_user_id
        WHERE r.conversation_key = $1 ORDER BY r.updated_at DESC`,
      [id],
    ),
  ]);
  if (!conversation.rows[0]) return null;
  return { ...conversation.rows[0], messages: messages.rows, reviews: reviews.rows };
}

const reviewLabels = new Set([
  'correct', 'too_long', 'too_technical', 'not_understood', 'faq_missing',
  'qualification_issue', 'possible_hallucination', 'possible_leak', 'needs_human_review',
]);

export async function saveReview({ conversationId, reviewerId, rating, labels, notes, status }) {
  const safeLabels = [...new Set(labels)].filter((label) => reviewLabels.has(label)).slice(0, 8);
  const safeStatus = ['pending', 'reviewed', 'needs_action', 'resolved'].includes(status) ? status : 'reviewed';
  const result = await database().query(
    `INSERT INTO ${table('chatbot_conversation_reviews')}
       (conversation_key, reviewer_user_id, rating, labels, notes, status)
     VALUES ($1, $2, $3, $4::text[], $5, $6)
     RETURNING id, rating, labels, notes, status, created_at, updated_at`,
    [conversationId, reviewerId, rating || null, safeLabels, String(notes || '').trim().slice(0, 2000) || null, safeStatus],
  );
  return result.rows[0];
}

export async function securitySummary() {
  const [auditRows, reviewRows] = await Promise.all([
    database().query(
      `SELECT a.id, a.action, a.resource_type, a.details, a.created_at,
              COALESCE(u.display_name, 'Sistema') AS actor
         FROM ${table('chatbot_admin_audit_log')} a
         LEFT JOIN ${table('chatbot_admin_users')} u ON u.id = a.actor_user_id
        ORDER BY a.created_at DESC LIMIT 100`,
    ),
    database().query(
      `SELECT count(*) FILTER (WHERE 'possible_leak' = ANY(labels))::int AS possible_leaks,
              count(*) FILTER (WHERE 'possible_hallucination' = ANY(labels))::int AS hallucinations,
              count(*) FILTER (WHERE status = 'needs_action')::int AS needs_action
         FROM ${table('chatbot_conversation_reviews')}`,
    ),
  ]);
  return { audit: auditRows.rows, reviewSignals: reviewRows.rows[0] };
}

export async function listUsers() {
  const result = await database().query(
    `SELECT id, email, display_name, role, active, failed_login_count, locked_until,
            last_login_at, created_at, updated_at
       FROM ${table('chatbot_admin_users')} ORDER BY display_name`,
  );
  return result.rows;
}

export async function setUserActive(id, active) {
  const result = await database().query(
    `UPDATE ${table('chatbot_admin_users')} SET active = $2, updated_at = now()
      WHERE id = $1 RETURNING id, email, display_name, role, active`,
    [id, active],
  );
  return result.rows[0] || null;
}

export async function createAnalysisRun({ requestedBy, periodStart, periodEnd }) {
  const id = randomUUID();
  await database().query(
    `INSERT INTO ${table('chatbot_analysis_runs')}
       (id, requested_by, status, period_start, period_end)
     VALUES ($1, $2, 'queued', $3, $4)`,
    [id, requestedBy, periodStart, periodEnd],
  );
  return id;
}

export async function updateAnalysisRun(id, fields) {
  await database().query(
    `UPDATE ${table('chatbot_analysis_runs')}
        SET status = $2, conversation_count = $3, summary = $4::jsonb,
            error_code = $5, completed_at = CASE WHEN $2 IN ('completed', 'failed') THEN now() ELSE NULL END
      WHERE id = $1`,
    [id, fields.status, fields.conversationCount || 0, JSON.stringify(fields.summary || {}), fields.errorCode || null],
  );
}

export async function conversationsForAnalysis(periodStart, periodEnd, limit = 250) {
  const result = await database().query(
    `SELECT c.conversation_key, c.language, c.stage, c.status,
            jsonb_agg(jsonb_build_object(
              'direction', m.direction, 'content', m.content, 'createdAt', m.created_at
            ) ORDER BY m.created_at) AS messages
       FROM ${table('chatbot_conversations')} c
       JOIN ${table('chatbot_messages')} m ON m.conversation_key = c.conversation_key
      WHERE m.created_at >= $1 AND m.created_at < $2
      GROUP BY c.conversation_key, c.language, c.stage, c.status
      ORDER BY max(m.created_at) DESC LIMIT $3`,
    [periodStart, periodEnd, limit],
  );
  return result.rows;
}

export async function saveFaqCandidates(runId, candidates) {
  const client = await database().connect();
  try {
    await client.query('BEGIN');
    for (const candidate of candidates.slice(0, 50)) {
      await client.query(
        `INSERT INTO ${table('chatbot_faq_candidates')}
           (id, analysis_run_id, language, question, suggested_answer, reason, evidence, occurrence_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
        [randomUUID(), runId, candidate.language || 'pt-BR', candidate.question,
          candidate.suggestedAnswer || null, candidate.reason,
          JSON.stringify(candidate.evidence || {}), candidate.occurrenceCount || 1],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listAnalysis() {
  const [runs, candidates] = await Promise.all([
    database().query(
      `SELECT r.id, r.status, r.period_start, r.period_end, r.conversation_count,
              r.summary, r.error_code, r.created_at, r.completed_at,
              u.display_name AS requested_by_name
         FROM ${table('chatbot_analysis_runs')} r
         LEFT JOIN ${table('chatbot_admin_users')} u ON u.id = r.requested_by
        ORDER BY r.created_at DESC LIMIT 20`,
    ),
    database().query(
      `SELECT c.id, c.status, c.language, c.question, c.suggested_answer, c.reason,
              c.evidence, c.occurrence_count, c.created_at, c.reviewed_at,
              u.display_name AS reviewed_by_name
         FROM ${table('chatbot_faq_candidates')} c
         LEFT JOIN ${table('chatbot_admin_users')} u ON u.id = c.reviewed_by
        ORDER BY c.created_at DESC LIMIT 100`,
    ),
  ]);
  return { runs: runs.rows, candidates: candidates.rows };
}

export async function reviewFaqCandidate({ id, status, reviewerId }) {
  if (!['accepted', 'rejected', 'suggested'].includes(status)) throw new Error('Status inválido.');
  const result = await database().query(
    `UPDATE ${table('chatbot_faq_candidates')}
        SET status = $2, reviewed_by = $3, reviewed_at = now(), updated_at = now()
      WHERE id = $1
      RETURNING id, status, reviewed_at`,
    [id, status, reviewerId],
  );
  return result.rows[0] || null;
}

export async function saveHealthSnapshot(snapshot) {
  await database().query(
    `INSERT INTO ${table('chatbot_health_snapshots')}
       (overall_status, components, response_time_ms)
     VALUES ($1, $2::jsonb, $3)`,
    [snapshot.overallStatus, JSON.stringify(snapshot.components), snapshot.responseTimeMs || null],
  );
}
