import { readFile } from 'node:fs/promises';
import { monitoringConfig } from './config.mjs';
import { databaseHealth, saveHealthSnapshot } from './database.mjs';

async function httpHealth(name, url, headers = {}) {
  if (!url) return { name, status: 'unknown', latencyMs: null };
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
    return {
      name,
      status: response.ok ? 'healthy' : 'down',
      latencyMs: Date.now() - startedAt,
      code: response.status,
    };
  } catch {
    return { name, status: 'down', latencyMs: Date.now() - startedAt };
  }
}

async function databaseComponent() {
  try {
    const result = await databaseHealth();
    return { name: 'database', status: 'healthy', latencyMs: result.latencyMs };
  } catch {
    return { name: 'database', status: 'down', latencyMs: null };
  }
}

export async function collectHealth({ persist = true } = {}) {
  const startedAt = Date.now();
  const components = await Promise.all([
    databaseComponent(),
    httpHealth('chatbot', monitoringConfig.chatbotHealthUrl),
    httpHealth('n8n', monitoringConfig.n8nHealthUrl),
    httpHealth('mail', `${monitoringConfig.mailServiceUrl}/health/ready`),
    httpHealth('evolution', monitoringConfig.evolutionHealthUrl,
      monitoringConfig.evolutionApiKey ? { apikey: monitoringConfig.evolutionApiKey } : {}),
  ]);
  const known = components.filter((component) => component.status !== 'unknown');
  const down = known.filter((component) => component.status === 'down').length;
  const overallStatus = down === 0 ? 'healthy' : down < known.length ? 'degraded' : 'down';
  const snapshot = { overallStatus, components, responseTimeMs: Date.now() - startedAt, checkedAt: new Date().toISOString() };
  if (persist) await saveHealthSnapshot(snapshot).catch(() => undefined);
  return snapshot;
}

export async function securityEvents() {
  let content = '';
  try {
    content = await readFile(monitoringConfig.eventsPath, 'utf8');
  } catch {
    return { counts: {}, recent: [], available: false };
  }
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const allowedDetails = new Set(['reason', 'errorType', 'score', 'answerSource']);
  const rows = content.split('\n').slice(-10000).flatMap((line) => {
    try {
      const event = JSON.parse(line);
      if (new Date(event.timestamp).getTime() < cutoff) return [];
      const details = Object.fromEntries(Object.entries(event).filter(([key]) => allowedDetails.has(key)));
      return [{ timestamp: event.timestamp, kind: String(event.kind || 'unknown').slice(0, 80), details }];
    } catch {
      return [];
    }
  });
  const counts = {};
  for (const row of rows) counts[row.kind] = (counts[row.kind] || 0) + 1;
  return { counts, recent: rows.slice(-100).reverse(), available: true };
}
