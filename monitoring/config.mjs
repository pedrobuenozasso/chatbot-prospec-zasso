function integer(name, fallback, minimum = 1, maximum = Number.MAX_SAFE_INTEGER) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} inválido.`);
  }
  return value;
}

function boolean(name, fallback = false) {
  const value = process.env[name];
  return value == null ? fallback : value.toLowerCase() === 'true';
}

function schema(value) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error('DATABASE_SCHEMA inválido.');
  return value;
}

export const monitoringConfig = Object.freeze({
  host: process.env.MONITORING_HOST || '127.0.0.1',
  port: integer('MONITORING_PORT', 3100, 1, 65535),
  publicOrigin: (process.env.MONITORING_PUBLIC_ORIGIN || 'http://localhost:3100').replace(/\/$/, ''),
  secureCookies: boolean('MONITORING_SECURE_COOKIES', process.env.NODE_ENV === 'production'),
  trustProxy: boolean('MONITORING_TRUST_PROXY', false),
  sessionHours: integer('MONITORING_SESSION_HOURS', 8, 1, 24),
  auditRetentionDays: integer('MONITORING_AUDIT_RETENTION_DAYS', 180, 30, 730),
  healthRetentionDays: integer('MONITORING_HEALTH_RETENTION_DAYS', 90, 7, 365),
  passwordPepper: process.env.MONITORING_PASSWORD_PEPPER || '',
  encryptionKey: process.env.MONITORING_ENCRYPTION_KEY || '',
  proxyToken: process.env.MONITORING_PROXY_TOKEN || '',
  requireProxy: boolean('MONITORING_REQUIRE_PROXY', false),
  allowedEmailDomain: (process.env.MONITORING_ALLOWED_EMAIL_DOMAIN || 'zasso.com').toLowerCase(),
  allowedEmails: Object.freeze(String(process.env.MONITORING_ALLOWED_EMAILS || '')
    .split(',').map((email) => email.trim().toLowerCase()).filter(Boolean)),
  databaseHost: process.env.DATABASE_HOST || process.env.PGHOST || 'cloudsql-proxy-pool',
  databasePort: integer('DATABASE_PORT', process.env.PGPORT || 5432, 1, 65535),
  databaseName: process.env.DATABASE_NAME || process.env.CLOUDSQL_DB_NAME || process.env.PGDATABASE || '',
  databaseUser: process.env.DATABASE_USER || process.env.CLOUDSQL_DB_USER || process.env.PGUSER || '',
  databasePassword: process.env.DATABASE_PASSWORD || process.env.CLOUDSQL_DB_PASSWORD || process.env.PGPASSWORD || '',
  databaseSchema: schema(process.env.DATABASE_SCHEMA || process.env.CLOUDSQL_DB_SCHEMA || 'public'),
  databasePoolMax: integer('MONITORING_DATABASE_POOL_MAX', 5, 1, 20),
  chatbotHealthUrl: process.env.MONITORING_CHATBOT_HEALTH_URL || 'http://zasso-chatbot:3000/healthz',
  n8nHealthUrl: process.env.MONITORING_N8N_HEALTH_URL || 'http://n8n:5678/healthz',
  evolutionHealthUrl: process.env.MONITORING_EVOLUTION_HEALTH_URL || '',
  evolutionApiKey: process.env.MONITORING_EVOLUTION_API_KEY || '',
  aiEnabled: boolean('MONITORING_AI_ANALYSIS_ENABLED', false),
  aiBaseUrl: (process.env.SACF_AI_BASE_URL || 'https://ai.sacf.io').replace(/\/$/, ''),
  aiToken: process.env.SACF_AI_SERVICE_TOKEN || '',
  aiModel: process.env.SACF_AI_MODEL || 'qwen2.5:14b',
  aiTenant: process.env.SACF_AI_TENANT_LABEL || 'Zasso',
  aiTimeoutMs: integer('MONITORING_AI_TIMEOUT_MS', 120000, 10000, 300000),
  eventsPath: process.env.MONITORING_EVENTS_PATH || '/chatbot-logs/events.jsonl',
});

export function assertSecureMonitoringConfig() {
  const missing = [];
  if (monitoringConfig.passwordPepper.length < 32) missing.push('MONITORING_PASSWORD_PEPPER');
  if (monitoringConfig.encryptionKey.length < 32) missing.push('MONITORING_ENCRYPTION_KEY');
  if (monitoringConfig.requireProxy && monitoringConfig.proxyToken.length < 32) missing.push('MONITORING_PROXY_TOKEN');
  if (!monitoringConfig.databaseName) missing.push('DATABASE_NAME');
  if (!monitoringConfig.databaseUser) missing.push('DATABASE_USER');
  if (!monitoringConfig.databasePassword) missing.push('DATABASE_PASSWORD');
  if (missing.length) throw new Error(`Configuração obrigatória ausente ou fraca: ${missing.join(', ')}`);
}

export function isAllowedAdminEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (monitoringConfig.allowedEmails.length) return monitoringConfig.allowedEmails.includes(email);
  return email.endsWith(`@${monitoringConfig.allowedEmailDomain}`);
}
