import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  audit,
  closeDatabase,
  createAnalysisRun,
  createOrUpdateUser,
  createSession,
  conversationDetail,
  deleteSession,
  enforceMonitoringRetention,
  findUserByEmail,
  listAnalysis,
  listConversations,
  listUsers,
  overview,
  recordLoginFailure,
  recordLoginSuccess,
  reviewFaqCandidate,
  saveReview,
  securitySummary,
  sessionUser,
  setUserActive,
} from './database.mjs';
import { monitoringConfig, assertSecureMonitoringConfig } from './config.mjs';
import {
  decryptSecret,
  encryptSecret,
  newOpaqueToken,
  randomTotpSecret,
  sha256,
  hashPassword,
  totpUri,
  verifyPassword,
  verifyTotp,
} from './security.mjs';
import { collectHealth, securityEvents } from './health.mjs';
import { executeAnalysisRun } from './analysis.mjs';

const currentDirectory = fileURLToPath(new URL('.', import.meta.url));
const publicDirectory = join(currentDirectory, 'public');
const sessionCookie = 'zasso_monitor_session';
const csrfCookie = 'zasso_monitor_csrf';
const maxBodyBytes = 32 * 1024;
const loginAttempts = new Map();
const dummyPasswordHash = hashPassword('invalid-login-password-do-not-use');

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.html': 'text/html; charset=utf-8',
};

function securityHeaders(contentType = 'application/json; charset=utf-8') {
  return {
    'content-type': contentType,
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'referrer-policy': 'no-referrer',
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  };
}

function json(response, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, { ...securityHeaders(), 'content-length': Buffer.byteLength(body), ...extraHeaders });
  response.end(body);
}

function clean(value, maximum = 200) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maximum);
}

function cookies(request) {
  return Object.fromEntries(String(request.headers.cookie || '').split(';').flatMap((entry) => {
    const separator = entry.indexOf('=');
    if (separator < 0) return [];
    return [[entry.slice(0, separator).trim(), decodeURIComponent(entry.slice(separator + 1).trim())]];
  }));
}

function clientIp(request) {
  if (monitoringConfig.trustProxy) return clean(String(request.headers['x-forwarded-for'] || '').split(',')[0], 80);
  return clean(request.socket.remoteAddress || '', 80);
}

function cookieHeader(value, expiresAt) {
  const secure = monitoringConfig.secureCookies ? '; Secure' : '';
  return `${sessionCookie}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict${secure}; Expires=${expiresAt.toUTCString()}`;
}

function csrfCookieHeader(value, expiresAt) {
  const secure = monitoringConfig.secureCookies ? '; Secure' : '';
  return `${csrfCookie}=${encodeURIComponent(value)}; Path=/; SameSite=Strict${secure}; Expires=${expiresAt.toUTCString()}`;
}

function clearCookieHeader() {
  const secure = monitoringConfig.secureCookies ? '; Secure' : '';
  return `${sessionCookie}=; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=0`;
}


function clearCsrfCookieHeader() {
  const secure = monitoringConfig.secureCookies ? '; Secure' : '';
  return `${csrfCookie}=; Path=/; SameSite=Strict${secure}; Max-Age=0`;
}

async function readBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) throw Object.assign(new Error('BODY_TOO_LARGE'), { statusCode: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw Object.assign(new Error('INVALID_JSON'), { statusCode: 400 });
  }
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  return !origin || origin === monitoringConfig.publicOrigin;
}

function roleAtLeast(userRole, required) {
  return { viewer: 1, reviewer: 2, admin: 3 }[userRole] >= { viewer: 1, reviewer: 2, admin: 3 }[required];
}

async function authenticate(request) {
  const token = cookies(request)[sessionCookie];
  const user = await sessionUser(token);
  return user ? { ...user, token } : null;
}

function requireCsrf(request, user) {
  const supplied = clean(request.headers['x-csrf-token'], 200);
  if (!supplied || sha256(supplied) !== user.csrf_hash) {
    throw Object.assign(new Error('CSRF_INVALID'), { statusCode: 403 });
  }
}

function loginRateAllowed(key) {
  const now = Date.now();
  const recent = (loginAttempts.get(key) || []).filter((time) => now - time < 15 * 60 * 1000);
  if (recent.length >= 12) return false;
  recent.push(now);
  loginAttempts.set(key, recent);
  return true;
}

function pagination(searchParams) {
  return {
    page: Math.max(1, Math.min(100000, Number(searchParams.get('page')) || 1)),
    limit: Math.max(10, Math.min(100, Number(searchParams.get('limit')) || 30)),
    status: clean(searchParams.get('status'), 32),
    segment: clean(searchParams.get('segment'), 24),
    search: clean(searchParams.get('search'), 120),
  };
}

async function handleLogin(request, response) {
  const ip = clientIp(request);
  if (!sameOrigin(request) || !loginRateAllowed(sha256(ip))) return json(response, 429, { error: 'Muitas tentativas. Aguarde alguns minutos.' });
  const body = await readBody(request);
  const email = clean(body.email, 254).toLowerCase();
  const password = String(body.password || '').slice(0, 300);
  const totp = clean(body.totp, 12);
  const user = await findUserByEmail(email);
  const validDomain = email.endsWith(`@${monitoringConfig.allowedEmailDomain}`);
  const validPassword = await verifyPassword(password, user?.password_hash || await dummyPasswordHash);
  const locked = user?.locked_until && new Date(user.locked_until).getTime() > Date.now();
  let validTotp = false;
  if (user?.totp_secret_encrypted) {
    try { validTotp = verifyTotp(decryptSecret(user.totp_secret_encrypted), totp); } catch { validTotp = false; }
  }
  if (!user || !user.active || !validDomain || locked || !validPassword || !validTotp) {
    if (user) await recordLoginFailure(user.id);
    await audit({ actorId: user?.id, action: 'login_failed', resourceType: 'session', details: { reason: locked ? 'locked' : 'invalid_credentials' }, ip });
    return json(response, 401, { error: locked ? 'Acesso temporariamente bloqueado.' : 'Credenciais ou código inválidos.' });
  }
  const token = newOpaqueToken();
  const csrfToken = newOpaqueToken(24);
  const expiresAt = await createSession({ token, csrfToken, userId: user.id, ip, userAgent: request.headers['user-agent'] || '' });
  await recordLoginSuccess(user.id);
  await audit({ actorId: user.id, action: 'login_succeeded', resourceType: 'session', ip });
  return json(response, 200, {
    user: { id: user.id, email: user.email, displayName: user.display_name, role: user.role },
    csrfToken,
  }, { 'set-cookie': [cookieHeader(token, expiresAt), csrfCookieHeader(csrfToken, expiresAt)] });
}

async function api(request, response, url) {
  if (request.method === 'POST' && url.pathname === '/api/login') return handleLogin(request, response);
  const user = await authenticate(request);
  if (!user) return json(response, 401, { error: 'Sessão expirada.' });
  const context = { actorId: user.id, ip: clientIp(request) };
  if (request.method !== 'GET') {
    if (!sameOrigin(request)) return json(response, 403, { error: 'Origem inválida.' });
    requireCsrf(request, user);
  }
  if (request.method === 'GET' && url.pathname === '/api/session') {
    return json(response, 200, { user: { id: user.id, email: user.email, displayName: user.display_name, role: user.role } });
  }
  if (request.method === 'POST' && url.pathname === '/api/logout') {
    await deleteSession(user.token);
    await audit({ ...context, action: 'logout', resourceType: 'session' });
    return json(response, 200, { ok: true }, { 'set-cookie': [clearCookieHeader(), clearCsrfCookieHeader()] });
  }
  if (request.method === 'GET' && url.pathname === '/api/overview') return json(response, 200, await overview());
  if (request.method === 'GET' && url.pathname === '/api/health') return json(response, 200, await collectHealth());
  if (request.method === 'GET' && url.pathname === '/api/conversations') {
    return json(response, 200, await listConversations(pagination(url.searchParams)));
  }
  const conversationMatch = url.pathname.match(/^\/api\/conversations\/([a-f0-9]{64})$/);
  if (request.method === 'GET' && conversationMatch) {
    const detail = await conversationDetail(conversationMatch[1]);
    if (!detail) return json(response, 404, { error: 'Conversa não encontrada.' });
    await audit({ ...context, action: 'conversation_viewed', resourceType: 'conversation', resource: conversationMatch[1] });
    return json(response, 200, detail);
  }
  const reviewMatch = url.pathname.match(/^\/api\/conversations\/([a-f0-9]{64})\/reviews$/);
  if (request.method === 'POST' && reviewMatch) {
    if (!roleAtLeast(user.role, 'reviewer')) return json(response, 403, { error: 'Permissão insuficiente.' });
    const body = await readBody(request);
    const review = await saveReview({
      conversationId: reviewMatch[1], reviewerId: user.id,
      rating: Math.max(1, Math.min(5, Number(body.rating) || 0)) || null,
      labels: Array.isArray(body.labels) ? body.labels.map((item) => clean(item, 40)) : [],
      notes: clean(body.notes, 2000), status: clean(body.status, 24),
    });
    await audit({ ...context, action: 'conversation_reviewed', resourceType: 'conversation', resource: reviewMatch[1], details: { labels: review.labels, status: review.status } });
    return json(response, 201, review);
  }
  if (request.method === 'GET' && url.pathname === '/api/security') {
    const [databaseSignals, events] = await Promise.all([securitySummary(), securityEvents()]);
    return json(response, 200, { ...databaseSignals, events });
  }
  if (request.method === 'GET' && url.pathname === '/api/analysis') return json(response, 200, await listAnalysis());
  if (request.method === 'POST' && url.pathname === '/api/analysis') {
    if (!roleAtLeast(user.role, 'reviewer')) return json(response, 403, { error: 'Permissão insuficiente.' });
    const now = new Date();
    const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const runId = await createAnalysisRun({ requestedBy: user.id, periodStart, periodEnd: now });
    await audit({ ...context, action: 'analysis_requested', resourceType: 'analysis_run', resource: runId, details: { periodDays: 7 } });
    void executeAnalysisRun({ runId, periodStart, periodEnd: now });
    return json(response, 202, { id: runId, status: 'queued' });
  }
  const candidateMatch = url.pathname.match(/^\/api\/faq-candidates\/([a-f0-9-]{36})$/);
  if (request.method === 'PATCH' && candidateMatch) {
    if (!roleAtLeast(user.role, 'reviewer')) return json(response, 403, { error: 'Permissão insuficiente.' });
    const body = await readBody(request);
    const candidate = await reviewFaqCandidate({ id: candidateMatch[1], status: clean(body.status, 24), reviewerId: user.id });
    if (!candidate) return json(response, 404, { error: 'Sugestão não encontrada.' });
    await audit({ ...context, action: 'faq_candidate_reviewed', resourceType: 'faq_candidate', resource: candidateMatch[1], details: { status: candidate.status } });
    return json(response, 200, candidate);
  }
  if (request.method === 'GET' && url.pathname === '/api/users') {
    if (!roleAtLeast(user.role, 'admin')) return json(response, 403, { error: 'Permissão insuficiente.' });
    return json(response, 200, { users: await listUsers() });
  }
  if (request.method === 'POST' && url.pathname === '/api/users') {
    if (!roleAtLeast(user.role, 'admin')) return json(response, 403, { error: 'Permissão insuficiente.' });
    const body = await readBody(request);
    const email = clean(body.email, 254).toLowerCase();
    if (!email.endsWith(`@${monitoringConfig.allowedEmailDomain}`)) return json(response, 400, { error: 'Use um e-mail corporativo autorizado.' });
    if (String(body.password || '').length < 14) return json(response, 400, { error: 'A senha temporária deve ter pelo menos 14 caracteres.' });
    if (!clean(body.displayName, 120)) return json(response, 400, { error: 'Informe o nome do usuário.' });
    const role = ['viewer', 'reviewer', 'admin'].includes(body.role) ? body.role : 'viewer';
    const secret = randomTotpSecret();
    const created = await createOrUpdateUser({
      email, displayName: clean(body.displayName, 120), password: String(body.password || ''), role,
      totpSecretEncrypted: encryptSecret(secret),
    });
    await audit({ ...context, action: 'user_created', resourceType: 'admin_user', resource: created.id, details: { role } });
    return json(response, 201, { user: created, totpSecret: secret, totpUri: totpUri(secret, email) });
  }
  const userActiveMatch = url.pathname.match(/^\/api\/users\/([a-f0-9-]{36})\/active$/);
  if (request.method === 'PATCH' && userActiveMatch) {
    if (!roleAtLeast(user.role, 'admin')) return json(response, 403, { error: 'Permissão insuficiente.' });
    const body = await readBody(request);
    if (userActiveMatch[1] === user.id && body.active === false) return json(response, 400, { error: 'Você não pode desativar seu próprio acesso.' });
    const updated = await setUserActive(userActiveMatch[1], body.active === true);
    if (!updated) return json(response, 404, { error: 'Usuário não encontrado.' });
    await audit({ ...context, action: 'user_access_changed', resourceType: 'admin_user', resource: updated.id, details: { active: updated.active } });
    return json(response, 200, updated);
  }
  return json(response, 404, { error: 'Rota não encontrada.' });
}

async function staticFile(request, response, url) {
  const asset = url.pathname === '/' || !extname(url.pathname) ? 'index.html' : url.pathname.slice(1);
  if (!/^[a-zA-Z0-9._/-]+$/.test(asset) || asset.includes('..')) return json(response, 404, { error: 'Não encontrado.' });
  try {
    const body = await readFile(join(publicDirectory, asset));
    const type = mimeTypes[extname(asset)] || 'application/octet-stream';
    const cache = asset === 'index.html' ? 'no-store' : 'public, max-age=3600';
    response.writeHead(200, { ...securityHeaders(type), 'cache-control': cache, 'content-length': body.length });
    response.end(body);
  } catch {
    if (asset !== 'index.html') return json(response, 404, { error: 'Não encontrado.' });
    return json(response, 500, { error: 'Painel indisponível.' });
  }
}

async function handle(request, response) {
  const url = new URL(request.url, monitoringConfig.publicOrigin);
  if (request.method === 'GET' && url.pathname === '/healthz') {
    const health = await collectHealth({ persist: false });
    return json(response, health.overallStatus === 'down' ? 503 : 200, { status: health.overallStatus, service: 'zasso-monitoring' });
  }
  if (url.pathname.startsWith('/api/')) return api(request, response, url);
  if (request.method === 'GET' || request.method === 'HEAD') return staticFile(request, response, url);
  return json(response, 405, { error: 'Método não permitido.' });
}

export function startMonitoringServer() {
  assertSecureMonitoringConfig();
  const server = createServer((request, response) => {
    handle(request, response).catch((error) => {
      const status = Number(error?.statusCode) || 500;
      if (status >= 500) console.error(JSON.stringify({ event: 'monitoring_request_error', errorType: error?.name || 'Error' }));
      json(response, status, { error: status >= 500 ? 'Não foi possível concluir a operação.' : error.message });
    });
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.listen(monitoringConfig.port, monitoringConfig.host, () => {
    console.log(`Painel Zasso disponível em ${monitoringConfig.host}:${monitoringConfig.port}`);
  });
  const cleanupTimer = setInterval(() => enforceMonitoringRetention().catch(() => undefined), 60 * 60 * 1000);
  cleanupTimer.unref();
  const healthTimer = setInterval(() => collectHealth().catch(() => undefined), 5 * 60 * 1000);
  healthTimer.unref();
  async function shutdown() {
    clearInterval(cleanupTimer);
    clearInterval(healthTimer);
    server.close();
    await closeDatabase();
  }
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) startMonitoringServer();
