const state = {
  user: null,
  csrfToken: '',
  view: 'overview',
  conversationPage: 1,
  conversationLimit: 30,
  loginEmail: '',
  area: '',
  campaignScreen: 'overview',
  campaignData: null,
};

const byId = (id) => document.getElementById(id);
const roleLevel = { viewer: 1, reviewer: 2, admin: 3 };
const labels = {
  active: 'Em atendimento', qualified: 'Qualificada', expired: 'Expirada',
  agro: 'Agro', urban: 'Urbano', other: 'Outro', completed: 'Concluída',
  pending: 'Pendente', reviewed: 'Revisada', needs_action: 'Precisa de ação', resolved: 'Resolvida',
  suggested: 'Sugerida', accepted: 'Aceita', rejected: 'Rejeitada', published: 'Publicada',
  healthy: 'Saudável', degraded: 'Atenção', down: 'Indisponível', unknown: 'Não configurado',
  queued: 'Na fila', running: 'Analisando', failed: 'Falhou',
  viewer: 'Visualizador', reviewer: 'Revisor', admin: 'Administrador',
  correct: 'Resposta correta', too_long: 'Muito longa', too_technical: 'Muito técnica',
  not_understood: 'Não compreendeu', faq_missing: 'FAQ ausente',
  qualification_issue: 'Falha na qualificação', possible_hallucination: 'Possível alucinação',
  possible_leak: 'Possível vazamento', needs_human_review: 'Revisão humana',
  ACTIVE: 'Ativa', PAUSED: 'Pausada', ARCHIVED: 'Arquivada', DELETED: 'Excluída',
  IN_PROCESS: 'Em processamento', WITH_ISSUES: 'Com problema',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

function formatDate(value, includeTime = true) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

function friendly(value) {
  return labels[value] || String(value || 'Não informado').replaceAll('_', ' ');
}

function badge(value) {
  const tone = ['healthy', 'qualified', 'completed', 'accepted', 'resolved', 'correct', 'active'].includes(value)
    ? 'green' : ['down', 'failed', 'possible_leak', 'rejected', 'needs_action'].includes(value) ? 'red' : 'amber';
  return `<span class="badge ${tone}">${escapeHtml(friendly(value))}</span>`;
}

function csrfFromCookie() {
  const item = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('zasso_monitor_csrf='));
  return item ? decodeURIComponent(item.slice(item.indexOf('=') + 1)) : '';
}

async function api(path, options = {}) {
  const headers = { accept: 'application/json', ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) headers['content-type'] = 'application/json';
  const csrf = state.csrfToken || csrfFromCookie();
  if (options.method && options.method !== 'GET' && csrf) headers['x-csrf-token'] = csrf;
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401 && !path.startsWith('/api/login-')) showLogin();
  if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação.');
  return payload;
}

let toastTimer;
function toast(message, error = false) {
  const element = byId('toast');
  element.textContent = message;
  element.className = `toast visible${error ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.className = 'toast'; }, 4200);
}

function loading(active) {
  byId('loading').classList.toggle('hidden', !active);
}

function showLogin(message = '') {
  state.user = null;
  state.csrfToken = '';
  byId('app-view').classList.add('hidden');
  byId('portal-view').classList.add('hidden');
  byId('login-view').classList.remove('hidden');
  byId('login-error').textContent = message;
}

function resetLoginForm({ preserveEmail = false } = {}) {
  const form = byId('login-form');
  const email = form.elements.email;
  form.dataset.step = 'request';
  byId('code-fields').classList.add('hidden');
  byId('login-secondary-actions').classList.add('hidden');
  byId('login-submit').textContent = 'Enviar código';
  form.elements.code.required = false;
  form.elements.code.value = '';
  email.readOnly = false;
  if (!preserveEmail) {
    email.value = '';
    state.loginEmail = '';
  }
  email.focus();
}

function showCodeStep(email) {
  const form = byId('login-form');
  state.loginEmail = email;
  form.dataset.step = 'verify';
  form.elements.email.value = email;
  form.elements.email.readOnly = true;
  form.elements.code.required = true;
  byId('code-fields').classList.remove('hidden');
  byId('login-secondary-actions').classList.remove('hidden');
  byId('login-submit').textContent = 'Entrar com o código';
  form.elements.code.focus();
}

function showPortal() {
  byId('login-view').classList.add('hidden');
  byId('app-view').classList.add('hidden');
  byId('portal-view').classList.remove('hidden');
  byId('portal-user').textContent = state.user?.displayName || state.user?.email || '';
  state.area = '';
}

function showApp(area = 'whatsapp') {
  byId('login-view').classList.add('hidden');
  byId('portal-view').classList.add('hidden');
  byId('app-view').classList.remove('hidden');
  state.area = area;
  byId('app-view').dataset.area = area;
  byId('sidebar-module-label').textContent = area === 'campaigns' ? 'Marketing Intelligence' : 'Lead Operations';
  byId('whatsapp-nav').classList.toggle('hidden', area !== 'whatsapp');
  byId('marketing-nav').classList.toggle('hidden', area !== 'campaigns');
  byId('sidebar-user').innerHTML = `<strong>${escapeHtml(state.user.displayName)}</strong><span>${escapeHtml(friendly(state.user.role))}</span>`;
  document.querySelectorAll('.admin-only').forEach((element) => element.classList.toggle('hidden', state.user.role !== 'admin'));
  document.querySelectorAll('.reviewer-only').forEach((element) => element.classList.toggle('hidden', roleLevel[state.user.role] < roleLevel.reviewer));
}

function metric(label, value, note = '') {
  return `<article class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? 0)}</strong>${note ? `<em>${escapeHtml(note)}</em>` : ''}</article>`;
}

function distributionRows(rows = [], empty = 'Sem dados no período') {
  if (!rows.length) return `<div class="empty-state">${escapeHtml(empty)}</div>`;
  const maximum = Math.max(...rows.map((row) => Number(row.value) || 0), 1);
  return rows.map((row) => `<div class="bar-row"><strong>${escapeHtml(friendly(row.label))}</strong><progress class="bar-progress" max="100" value="${Math.max(4, (Number(row.value) || 0) / maximum * 100)}" aria-label="${escapeHtml(friendly(row.label))}"></progress><b>${Number(row.value) || 0}</b></div>`).join('');
}

function rankRows(rows = [], empty = 'Sem dados no período') {
  if (!rows.length) return `<div class="empty-state">${escapeHtml(empty)}</div>`;
  return rows.map((row) => `<div class="rank-row"><div><strong>${escapeHtml(friendly(row.label))}</strong><span>Últimos 30 dias</span></div><b>${Number(row.value) || 0}</b></div>`).join('');
}

function conversationTable(items = []) {
  if (!items.length) return '<div class="empty-state">Nenhuma conversa encontrada.</div>';
  const canReview = state.user && roleLevel[state.user.role] >= roleLevel.reviewer;
  return `<table class="data-table"><thead><tr><th>Revisão</th><th>Protocolo</th><th>Lead</th><th>Segmento</th><th>Região</th><th>Idioma</th><th>Status</th><th>Mensagens</th><th>Atualizada</th><th></th></tr></thead><tbody>${items.map((item) => {
    const flagged = item.review_status === 'needs_action';
    const reviewButton = canReview ? `<button class="review-flag-button ${flagged ? 'flagged' : ''}" type="button" data-review-flag="${escapeHtml(item.id)}" data-flagged="${flagged}" aria-pressed="${flagged}" aria-label="${flagged ? 'Remover da fila de revisão' : 'Marcar para revisão'}" title="${flagged ? 'Remover da fila de revisão' : 'Marcar para revisão'}">&#128276;</button>` : badge(item.review_status);
    return `<tr class="clickable" data-conversation-id="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="Abrir conversa ${escapeHtml(item.protocol || item.id.slice(0, 10).toUpperCase())}"><td>${reviewButton}</td><td class="protocol">${escapeHtml(item.protocol || item.id.slice(0, 10).toUpperCase())}</td><td>${escapeHtml(item.contact_name || 'Não informado')}</td><td>${escapeHtml(friendly(item.segment))}</td><td>${escapeHtml(item.region || '—')}</td><td>${escapeHtml(item.language)}</td><td>${badge(item.status)}</td><td>${Number(item.message_count) || 0}</td><td>${escapeHtml(formatDate(item.updated_at))}</td><td><button class="small-button conversation-open-button" type="button" data-conversation-id="${escapeHtml(item.id)}">Ver conversa</button></td></tr>`;
  }).join('')}</tbody></table>`;
}

async function loadOverview() {
  const [overview, health, conversations] = await Promise.all([
    api('/api/overview'), api('/api/health'), api('/api/conversations?limit=6'),
  ]);
  const counts = overview.counts || {};
  byId('metric-grid').innerHTML = [
    metric('Conversas · 24h', counts.conversations_24h), metric('Mensagens · 24h', counts.messages_24h),
    metric('Qualificados · 7d', counts.qualified_7d), metric('Baixa confiança · 7d', counts.fallbacks_7d),
    metric('Ativos agora', counts.active_now), metric('Precisam de ação', counts.needs_action),
  ].join('');
  byId('segment-chart').innerHTML = distributionRows(overview.segments);
  byId('language-list').innerHTML = rankRows(overview.languages);
  byId('status-list').innerHTML = rankRows(overview.statuses);
  byId('recent-conversations').innerHTML = conversationTable(conversations.items);
  renderHealth(health);
}

function renderHealth(health) {
  const components = (health.components || []).map((component) => `<span><b>${escapeHtml(friendly(component.name))}</b> · ${escapeHtml(friendly(component.status))}${component.latencyMs != null ? ` · ${Number(component.latencyMs)} ms` : ''}</span>`).join('');
  byId('health-banner').innerHTML = `<div class="health-main"><span class="status-dot ${escapeHtml(health.overallStatus)}"></span><div><strong>Operação ${escapeHtml(friendly(health.overallStatus).toLowerCase())}</strong><span>Verificação em ${escapeHtml(formatDate(health.checkedAt))}</span></div></div><div class="health-components">${components}</div>`;
}

async function loadConversations() {
  const params = new URLSearchParams({ page: String(state.conversationPage), limit: String(state.conversationLimit) });
  const search = byId('conversation-search').value.trim();
  const status = byId('conversation-status').value;
  const segment = byId('conversation-segment').value;
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (segment) params.set('segment', segment);
  const result = await api(`/api/conversations?${params}`);
  byId('conversation-total').textContent = `${result.total} conversa${result.total === 1 ? '' : 's'}`;
  byId('conversation-table').innerHTML = conversationTable(result.items);
  const pages = Math.max(1, Math.ceil(result.total / result.limit));
  byId('conversation-pagination').innerHTML = `<button data-page="${state.conversationPage - 1}" ${state.conversationPage <= 1 ? 'disabled' : ''}>Anterior</button><span class="period-pill">${state.conversationPage} de ${pages}</span><button data-page="${state.conversationPage + 1}" ${state.conversationPage >= pages ? 'disabled' : ''}>Próxima</button>`;
}

function summaryItem(label, value) {
  return `<div class="summary-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || '—')}</strong></div>`;
}

async function openConversation(id) {
  loading(true);
  try {
    const item = await api(`/api/conversation?id=${encodeURIComponent(id)}`);
    byId('drawer-title').textContent = item.protocol || `Conversa ${id.slice(0, 10)}`;
    const summary = [
      summaryItem('Lead', item.contact_name), summaryItem('Segmento', friendly(item.segment)),
      summaryItem('Região', item.region), summaryItem('Idioma', item.language),
      summaryItem(item.segment === 'agro' ? 'Cultivo' : 'Perfil urbano', item.segment === 'agro' ? item.crop_or_application : friendly(item.urban_profile)),
      summaryItem('Área', item.area_text), summaryItem('Status', friendly(item.status)), summaryItem('Início', formatDate(item.created_at)),
      summaryItem('Última atividade', formatDate(item.updated_at)),
    ].join('');
    const messages = (item.messages || []).map((message) => {
      const inbound = message.direction === 'inbound';
      const author = inbound ? (item.contact_name || 'Lead') : 'Bot Zasso';
      const directionLabel = inbound ? 'Mensagem recebida' : 'Resposta enviada';
      const sources = Array.isArray(message.metadata?.sources) && message.metadata.sources.length
        ? `<div class="message-sources">Fontes: ${message.metadata.sources.map(escapeHtml).join(', ')}</div>` : '';
      return `<article class="message ${inbound ? 'inbound' : 'outbound'}"><header class="message-meta"><strong>${escapeHtml(author)}</strong><span>${escapeHtml(directionLabel)}</span></header><div class="message-body">${escapeHtml(message.content)}</div>${sources}<time>${escapeHtml(formatDate(message.created_at))}</time></article>`;
    }).join('') || '<div class="empty-state">As mensagens já expiraram pela política de retenção de 15 dias.</div>';
    const messageHeading = `<div class="message-section-heading"><div><p class="panel-kicker">HISTÓRICO COMPLETO</p><h3>Mensagens trocadas</h3></div><span class="period-pill">${Number(item.messages?.length) || 0} mensagem${item.messages?.length === 1 ? '' : 's'}</span></div>`;
    const lastReview = item.reviews?.[0];
    const review = roleLevel[state.user.role] >= roleLevel.reviewer ? reviewForm(item.id, lastReview) : '<div class="empty-state">Seu perfil possui acesso somente para consulta.</div>';
    byId('drawer-content').innerHTML = `<div class="conversation-summary">${summary}</div>${messageHeading}<div class="message-stream">${messages}</div>${review}`;
    const drawer = byId('conversation-drawer');
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  } catch (error) {
    toast(error.message, true);
  } finally {
    loading(false);
  }
}

function reviewForm(conversationId, review) {
  const options = ['correct', 'too_long', 'too_technical', 'not_understood', 'faq_missing', 'qualification_issue', 'possible_hallucination', 'possible_leak', 'needs_human_review'];
  const selected = new Set(review?.labels || []);
  return `<form class="review-form" data-review-conversation="${escapeHtml(conversationId)}"><div class="panel-heading"><div><p class="panel-kicker">REVISÃO HUMANA</p><h2>Qualidade da conversa</h2></div></div><label>Avaliação<select name="rating"><option value="">Sem nota</option>${[5, 4, 3, 2, 1].map((value) => `<option value="${value}" ${Number(review?.rating) === value ? 'selected' : ''}>${value} de 5</option>`).join('')}</select></label><div class="review-labels">${options.map((value) => `<label><input type="checkbox" name="labels" value="${value}" ${selected.has(value) ? 'checked' : ''}>${escapeHtml(friendly(value))}</label>`).join('')}</div><label>Status<select name="status">${['reviewed', 'needs_action', 'resolved'].map((value) => `<option value="${value}" ${review?.status === value ? 'selected' : ''}>${escapeHtml(friendly(value))}</option>`).join('')}</select></label><label>Observações<textarea name="notes" maxlength="2000" placeholder="Registre o problema e a correção esperada.">${escapeHtml(review?.notes || '')}</textarea></label><button class="primary-button" type="submit">Salvar revisão</button></form>`;
}

function closeDrawer() {
  const drawer = byId('conversation-drawer');
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
}

async function loadQuality() {
  const [data, queue] = await Promise.all([api('/api/analysis'), api('/api/reviews?limit=100')]);
  byId('review-queue-total').textContent = `${queue.total} marcada${queue.total === 1 ? '' : 's'}`;
  byId('review-queue').innerHTML = conversationTable(queue.items);
  byId('analysis-runs').innerHTML = data.runs?.length ? data.runs.map((run) => `<article class="stack-item"><header><strong>${escapeHtml(formatDate(run.created_at))}</strong>${badge(run.status)}</header><p>${Number(run.conversation_count) || 0} conversas analisadas · ${escapeHtml(run.summary?.mode || 'aguardando')}</p><p>${escapeHtml(run.summary?.note || run.error_code || '')}</p></article>`).join('') : '<div class="empty-state">Nenhuma análise executada.</div>';
  byId('faq-candidates').innerHTML = data.candidates?.length ? data.candidates.map((candidate) => `<article class="candidate-card"><header><strong>${escapeHtml(candidate.question)}</strong>${badge(candidate.status)}</header><p><b>${Number(candidate.occurrence_count) || 1} ocorrência(s)</b> · ${escapeHtml(candidate.language)}</p><p>${escapeHtml(candidate.reason)}</p>${candidate.suggested_answer ? `<p><strong>Rascunho:</strong> ${escapeHtml(candidate.suggested_answer)}</p>` : ''}${candidate.status === 'suggested' && roleLevel[state.user.role] >= roleLevel.reviewer ? `<div class="candidate-actions"><button class="small-button accept" data-candidate-id="${candidate.id}" data-candidate-status="accepted">Aceitar para validação</button><button class="small-button reject" data-candidate-id="${candidate.id}" data-candidate-status="rejected">Rejeitar</button></div>` : ''}</article>`).join('') : '<div class="empty-state">Nenhuma sugestão pendente.</div>';
}

async function loadSecurity() {
  const data = await api('/api/security');
  byId('security-metrics').innerHTML = [
    metric('Possíveis vazamentos', data.reviewSignals?.possible_leaks || 0),
    metric('Possíveis alucinações', data.reviewSignals?.hallucinations || 0),
    metric('Revisões pendentes', data.reviewSignals?.needs_action || 0),
  ].join('');
  const eventRows = Object.entries(data.events?.counts || {}).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  byId('event-counts').innerHTML = rankRows(eventRows, data.events?.available ? 'Nenhum evento no período.' : 'Log operacional ainda não está conectado.');
  byId('audit-table').innerHTML = data.audit?.length ? `<table class="data-table"><thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Recurso</th></tr></thead><tbody>${data.audit.map((row) => `<tr><td>${escapeHtml(formatDate(row.created_at))}</td><td>${escapeHtml(row.actor)}</td><td>${escapeHtml(friendly(row.action))}</td><td>${escapeHtml(friendly(row.resource_type))}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">Nenhum acesso auditado.</div>';
}

async function loadUsers() {
  if (state.user.role !== 'admin') return;
  const data = await api('/api/users');
  byId('user-table').innerHTML = data.users?.length ? `<table class="data-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Último acesso</th><th>Status</th><th></th></tr></thead><tbody>${data.users.map((user) => `<tr><td>${escapeHtml(user.display_name)}</td><td>${escapeHtml(user.email)}</td><td>${escapeHtml(friendly(user.role))}</td><td>${escapeHtml(formatDate(user.last_login_at))}</td><td>${user.active ? badge('active') : badge('down')}</td><td><button class="small-button" data-user-id="${user.id}" data-user-active="${user.active ? 'false' : 'true'}" ${user.id === state.user.id ? 'disabled' : ''}>${user.active ? 'Desativar' : 'Ativar'}</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">Nenhum usuário cadastrado.</div>';
}

function formatNumber(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits }).format(Number(value) || 0);
}

function formatCurrency(value, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function formatCompactCurrency(value, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0);
}

function formatPercent(value) {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(value) || 0)}%`;
}

function campaignMetric(label, value, note = '') {
  return `<article class="campaign-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${note ? `<em>${escapeHtml(note)}</em>` : ''}</article>`;
}

function campaignStatusClass(status) {
  return String(status || '').toLowerCase().replaceAll('_', '-');
}

function campaignTable(items = [], currency = 'BRL') {
  if (!items.length) return '<div class="empty-state">Nenhuma campanha encontrada neste filtro.</div>';
  return `<table class="data-table"><thead><tr><th>Campanha</th><th>Status</th><th>Investimento</th><th>Alcance</th><th>Impressões</th><th>Cliques</th><th>CTR</th><th>Conversas</th><th>Custo/resultado</th></tr></thead><tbody>${items.map((campaign) => {
    const metrics = campaign.metrics || {};
    const costPerResult = metrics.results > 0 ? metrics.spend / metrics.results : null;
    return `<tr><td data-label="Campanha" class="campaign-name">${escapeHtml(campaign.name)}</td><td data-label="Status"><span class="campaign-status campaign-status-${campaignStatusClass(campaign.effectiveStatus)}">${escapeHtml(friendly(campaign.effectiveStatus))}</span></td><td data-label="Investimento" class="campaign-number">${escapeHtml(formatCurrency(metrics.spend, currency))}</td><td data-label="Alcance" class="campaign-number">${escapeHtml(formatNumber(metrics.reach))}</td><td data-label="Impressões" class="campaign-number">${escapeHtml(formatNumber(metrics.impressions))}</td><td data-label="Cliques" class="campaign-number">${escapeHtml(formatNumber(metrics.clicks))}</td><td data-label="CTR" class="campaign-number">${escapeHtml(formatPercent(metrics.ctr))}</td><td data-label="Conversas" class="campaign-number">${escapeHtml(formatNumber(metrics.results))}</td><td data-label="Custo/resultado" class="campaign-number">${costPerResult == null ? '—' : escapeHtml(formatCurrency(costPerResult, currency))}</td></tr>`;
  }).join('')}</tbody></table>`;
}

function completeCampaignDailyRows(rows = [], period = {}) {
  if (!rows.length) return [];
  const validDate = /^\d{4}-\d{2}-\d{2}$/;
  const since = validDate.test(String(period.since || '')) ? period.since : rows[0]?.date;
  const until = validDate.test(String(period.until || '')) ? period.until : rows.at(-1)?.date;
  if (!validDate.test(String(since || '')) || !validDate.test(String(until || ''))) return rows;
  const values = new Map(rows.map((row) => [row.date, row]));
  const completed = [];
  const cursor = new Date(`${since}T00:00:00Z`);
  const end = new Date(`${until}T00:00:00Z`);
  while (cursor <= end && completed.length < 92) {
    const date = cursor.toISOString().slice(0, 10);
    const row = values.get(date) || {};
    completed.push({ date, spend: Number(row.spend) || 0, results: Number(row.results) || 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return completed;
}

function smoothChartPath(points = []) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  const tension = 0.18;
  let path = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const previous = points[index - 1] || current;
    const after = points[index + 2] || next;
    const controlOne = [current[0] + (next[0] - previous[0]) * tension, current[1] + (next[1] - previous[1]) * tension];
    const controlTwo = [next[0] - (after[0] - current[0]) * tension, next[1] - (after[1] - current[1]) * tension];
    path += ` C ${controlOne[0].toFixed(2)} ${controlOne[1].toFixed(2)}, ${controlTwo[0].toFixed(2)} ${controlTwo[1].toFixed(2)}, ${next[0].toFixed(2)} ${next[1].toFixed(2)}`;
  }
  return path;
}

function campaignTimelineChart(rows = [], currency = 'BRL', period = {}) {
  if (!rows.length) return '<div class="empty-state">A Meta não retornou atividade diária no período.</div>';
  const completedRows = completeCampaignDailyRows(rows, period);
  const totalSpend = completedRows.reduce((sum, row) => sum + Number(row.spend || 0), 0);
  const totalResults = completedRows.reduce((sum, row) => sum + Number(row.results || 0), 0);
  const bestDay = [...completedRows].sort((a, b) => Number(b.spend) - Number(a.spend))[0];
  const bestDayLabel = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(`${bestDay.date}T12:00:00Z`));
  const maximumSpend = Math.max(...rows.map((row) => Number(row.spend) || 0), 1);
  const maximumResults = Math.max(...rows.map((row) => Number(row.results) || 0), 1);
  const labelStep = completedRows.length <= 14 ? 1 : Math.ceil(completedRows.length / 10);
  const spendPoints = completedRows.map((row, index) => {
    const x = ((index + 0.5) / completedRows.length) * 1000;
    const y = 92 - ((Number(row.spend) || 0) / maximumSpend) * 78;
    return [x, y];
  });
  const resultPoints = completedRows.map((row, index) => {
    const x = ((index + 0.5) / completedRows.length) * 1000;
    const y = 92 - ((Number(row.results) || 0) / maximumResults) * 78;
    return [x, y];
  });
  const spendLine = smoothChartPath(spendPoints);
  const resultLine = smoothChartPath(resultPoints);
  const spendArea = `${spendLine} L ${spendPoints.at(-1)[0].toFixed(2)} 100 L ${spendPoints[0][0].toFixed(2)} 100 Z`;
  const resultArea = `${resultLine} L ${resultPoints.at(-1)[0].toFixed(2)} 100 L ${resultPoints[0][0].toFixed(2)} 100 Z`;
  const columns = completedRows.map((row, index) => {
    const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(`${row.date}T12:00:00Z`));
    const title = `${date}: ${formatCurrency(row.spend, currency)} · ${formatNumber(row.results)} conversa(s)`;
    const label = index % labelStep === 0 || index === completedRows.length - 1 ? date : '';
    const costPerResult = Number(row.results) > 0 ? Number(row.spend) / Number(row.results) : null;
    return `<div class="campaign-chart-column" tabindex="0" role="group" aria-label="${escapeHtml(title)}"><div class="campaign-chart-track"><i class="campaign-hover-rule" aria-hidden="true"></i><div class="campaign-chart-tooltip"><strong>${escapeHtml(date)}</strong><span>Investimento <b>${escapeHtml(formatCurrency(row.spend, currency))}</b></span><span>Conversas <b>${escapeHtml(formatNumber(row.results))}</b></span><span>Custo/conversa <b>${costPerResult == null ? '—' : escapeHtml(formatCurrency(costPerResult, currency))}</b></span></div></div><span class="campaign-chart-date">${escapeHtml(label)}</span></div>`;
  }).join('');
  const density = completedRows.length <= 7 ? 'short' : completedRows.length <= 14 ? 'medium' : completedRows.length <= 31 ? 'long' : 'extended';
  return `<div class="campaign-chart-report"><div class="campaign-chart-summary"><div><span>Média diária</span><strong>${escapeHtml(formatCurrency(totalSpend / completedRows.length, currency))}</strong></div><div><span>Pico de investimento</span><strong>${escapeHtml(bestDayLabel)} · ${escapeHtml(formatCurrency(bestDay.spend, currency))}</strong></div><div><span>Resultado do período</span><strong>${escapeHtml(formatNumber(totalResults))} conversas</strong></div></div><div class="campaign-chart-legend"><span><i class="legend-spend"></i>Investimento diário</span><span><i class="legend-results"></i>Conversas · máximo ${escapeHtml(formatNumber(maximumResults))}/dia</span><em>Toque em um ponto. No celular, arraste o gráfico para navegar.</em></div><div class="campaign-timeline-scroll"><div class="campaign-timeline campaign-timeline-${density}"><div class="campaign-chart-axis" aria-hidden="true"><span>${escapeHtml(formatCompactCurrency(maximumSpend, currency))}</span><span>${escapeHtml(formatCompactCurrency(maximumSpend / 2, currency))}</span><span>${escapeHtml(formatCompactCurrency(0, currency))}</span></div><div class="campaign-chart-data"><div class="campaign-chart-grid" aria-hidden="true"><i></i><i></i><i></i></div><svg class="campaign-series-chart" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><path class="campaign-area campaign-area-spend" d="${spendArea}"/><path class="campaign-area campaign-area-results" d="${resultArea}"/><path class="campaign-line campaign-line-spend" d="${spendLine}" vector-effect="non-scaling-stroke"/><path class="campaign-line campaign-line-results" d="${resultLine}" vector-effect="non-scaling-stroke"/></svg><div class="campaign-chart-columns">${columns}</div></div></div></div></div>`;
}

function campaignChart(rows = [], currency = 'BRL', period = {}) {
  return campaignTimelineChart(rows, currency, period);
}

function campaignDualChart(rows = [], currency = 'BRL', period = {}) {
  return campaignTimelineChart(rows, currency, period);
}

function campaignSpendDistribution(items = [], currency = 'BRL') {
  const allRanked = [...items].filter((item) => Number(item.metrics?.spend) > 0).sort((a, b) => Number(b.metrics?.spend) - Number(a.metrics?.spend));
  const ranked = allRanked.slice(0, 4);
  if (!ranked.length) return '<div class="empty-state">Nenhum investimento registrado neste período.</div>';
  const total = items.reduce((sum, item) => sum + Number(item.metrics?.spend || 0), 0) || 1;
  const entries = ranked.map((item) => ({ name: item.name, spend: Number(item.metrics?.spend || 0) }));
  const remaining = allRanked.slice(4).reduce((sum, item) => sum + Number(item.metrics?.spend || 0), 0);
  if (remaining > 0) entries.push({ name: 'Outras campanhas', spend: remaining });
  let cursor = 0;
  const segments = entries.map((item, index) => {
    const share = (item.spend / total) * 100;
    const offset = cursor;
    cursor += share;
    return `<circle class="campaign-donut-segment campaign-donut-segment-${index}" cx="21" cy="21" r="15.9155" pathLength="100" fill="none" stroke-dasharray="${share.toFixed(2)} ${(100 - share).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"/>`;
  }).join('');
  const legend = entries.map((item, index) => {
    const spend = Number(item.spend || 0);
    const share = (spend / total) * 100;
    return `<div class="campaign-distribution-item"><i class="campaign-distribution-dot campaign-distribution-dot-${index}" aria-hidden="true"></i><div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(formatCurrency(spend, currency))} · ${escapeHtml(formatPercent(share))}</span></div></div>`;
  }).join('');
  return `<div class="campaign-donut-wrap"><div class="campaign-donut" role="img" aria-label="Distribuição do investimento entre campanhas"><svg viewBox="0 0 42 42" aria-hidden="true">${segments}</svg><div><span>Investimento</span><strong>${escapeHtml(formatCurrency(total, currency))}</strong><em>no período</em></div></div><div class="campaign-donut-legend">${legend}</div></div>`;
}

function campaignFunnel(totals = {}) {
  const rows = [
    ['Impressões', totals.impressions], ['Alcance', totals.reach], ['Cliques', totals.clicks], ['Conversas', totals.results],
  ];
  const maximum = Math.max(Number(totals.impressions) || 0, 1);
  return rows.map(([label, value]) => {
    const width = Math.max(4, (Number(value) || 0) / maximum * 100);
    return `<div class="campaign-funnel-step"><div><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatNumber(value))}</strong></div><progress class="campaign-funnel-progress" max="100" value="${width.toFixed(2)}" aria-label="${escapeHtml(label)}"></progress></div>`;
  }).join('');
}

function campaignHighlights(items = [], currency = 'BRL') {
  if (!items.length) return '<div class="empty-state">Nenhuma campanha disponível para destacar.</div>';
  const byResults = [...items].sort((a, b) => Number(b.metrics?.results) - Number(a.metrics?.results))[0];
  const bySpend = [...items].sort((a, b) => Number(b.metrics?.spend) - Number(a.metrics?.spend))[0];
  const byCtr = [...items].sort((a, b) => Number(b.metrics?.ctr) - Number(a.metrics?.ctr))[0];
  const rows = [
    ['Mais conversas', byResults, `${formatNumber(byResults.metrics?.results)} reportadas`],
    ['Maior investimento', bySpend, formatCurrency(bySpend.metrics?.spend, currency)],
    ['Maior CTR', byCtr, formatPercent(byCtr.metrics?.ctr)],
  ];
  return rows.map(([label, item, value]) => `<div class="campaign-highlight-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(item.name)}</strong><em>${escapeHtml(value)}</em></div>`).join('');
}

function setCampaignScreen(screen = 'overview') {
  const selected = ['overview', 'performance', 'list'].includes(screen) ? screen : 'overview';
  state.campaignScreen = selected;
  document.querySelectorAll('.campaign-screen').forEach((element) => element.classList.toggle('hidden', element.id !== `campaign-screen-${selected}`));
  document.querySelectorAll('[data-marketing-view]').forEach((element) => element.classList.toggle('active', element.dataset.marketingView === selected));
  const titles = {
    overview: ['MÍDIA E AQUISIÇÃO', 'Visão geral'],
    performance: ['ANÁLISE DE RESULTADOS', 'Desempenho'],
    list: ['GESTÃO DE MÍDIA', 'Campanhas'],
  };
  byId('page-eyebrow').textContent = titles[selected][0];
  byId('page-title').textContent = titles[selected][1];
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function renderCampaignScreens(data, days) {
  const totals = data.totals || {};
  const currency = data.currency || 'BRL';
  const campaigns = data.campaigns || [];
  byId('campaign-overview-metrics').innerHTML = [
    campaignMetric('Investimento', formatCurrency(totals.spend, currency), `${days} dias`),
    campaignMetric('Conversas', formatNumber(totals.results), 'Atribuição Meta'),
    campaignMetric('Custo por conversa', totals.costPerResult == null ? '—' : formatCurrency(totals.costPerResult, currency)),
    campaignMetric('Campanhas ativas', formatNumber(totals.activeCampaigns), `${formatNumber(totals.campaignCount)} no filtro`),
  ].join('');
  byId('campaign-performance-metrics').innerHTML = [
    campaignMetric('Alcance', formatNumber(totals.reach)),
    campaignMetric('Impressões', formatNumber(totals.impressions)),
    campaignMetric('Frequência', formatNumber(totals.frequency, 2)),
    campaignMetric('Cliques', formatNumber(totals.clicks)),
    campaignMetric('CTR', formatPercent(totals.ctr)),
    campaignMetric('CPC', formatCurrency(totals.cpc, currency)),
  ].join('');
  byId('campaign-list-metrics').innerHTML = [
    campaignMetric('Total no filtro', formatNumber(totals.campaignCount)),
    campaignMetric('Ativas', formatNumber(totals.activeCampaigns)),
    campaignMetric('Pausadas', formatNumber(campaigns.filter((item) => item.effectiveStatus === 'PAUSED').length)),
    campaignMetric('Com problema', formatNumber(campaigns.filter((item) => item.effectiveStatus === 'WITH_ISSUES').length)),
  ].join('');
  const period = `${data.period.since} — ${data.period.until}`;
  byId('campaign-period').textContent = period;
  byId('campaign-overview-period').textContent = period;
  byId('campaign-updated').textContent = `Atualizado ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(data.updatedAt))}${data.cached ? ' · cache' : ''}`;
  byId('campaign-overview-chart').innerHTML = campaignChart(data.daily, currency, data.period);
  byId('campaign-chart').innerHTML = campaignDualChart(data.daily, currency, data.period);
  byId('campaign-spend-distribution').innerHTML = campaignSpendDistribution(campaigns, currency);
  byId('campaign-highlights').innerHTML = campaignHighlights(campaigns, currency);
  byId('campaign-funnel').innerHTML = campaignFunnel(totals);
  byId('campaign-summary').innerHTML = `<div class="campaign-summary-list"><div class="campaign-summary-item"><span>Custo por conversa</span><strong>${totals.costPerResult == null ? '—' : escapeHtml(formatCurrency(totals.costPerResult, currency))}</strong></div><div class="campaign-summary-item"><span>CPC médio</span><strong>${escapeHtml(formatCurrency(totals.cpc, currency))}</strong></div><div class="campaign-summary-item"><span>CPM médio</span><strong>${escapeHtml(formatCurrency(totals.cpm, currency))}</strong></div></div>`;
  const query = String(byId('campaign-search').value || '').trim().toLocaleLowerCase('pt-BR');
  byId('campaign-table').innerHTML = campaignTable(query ? campaigns.filter((item) => String(item.name || '').toLocaleLowerCase('pt-BR').includes(query)) : campaigns, currency);
}

async function loadCampaigns() {
  const days = byId('campaign-days').value;
  const status = byId('campaign-status').value;
  const params = new URLSearchParams({ days });
  if (status) params.set('status', status);
  const data = await api(`/api/meta-campaigns?${params}`);
  byId('campaign-account').textContent = data.accountId || 'Conta ainda não configurada';
  byId('campaign-setup').classList.toggle('hidden', data.configured);
  byId('campaign-content').classList.toggle('hidden', !data.configured);
  if (!data.configured) {
    byId('campaign-setup').innerHTML = '<h2>Conexão Meta pendente</h2><p>Cadastre o ID da conta e o token de leitura no ambiente protegido do painel. Nenhum dado de campanha é exposto no navegador.</p>';
    return;
  }
  state.campaignData = data;
  renderCampaignScreens(data, days);
  setCampaignScreen(state.campaignScreen);
}

const viewConfig = {
  overview: ['OPERAÇÃO EM TEMPO REAL', 'Visão geral', loadOverview],
  conversations: ['HISTÓRICO E REVISÃO', 'Conversas', loadConversations],
  quality: ['MELHORIA CONTROLADA', 'Revisões e FAQs', loadQuality],
  security: ['CONTROLE E AUDITORIA', 'Segurança', loadSecurity],
  campaigns: ['MÍDIA E AQUISIÇÃO', 'Campanhas Meta', loadCampaigns],
  users: ['ACESSO RESTRITO', 'Usuários e permissões', loadUsers],
};

async function navigate(view, showLoader = true) {
  if (!viewConfig[view] || (view === 'users' && state.user.role !== 'admin')) return;
  state.view = view;
  document.querySelectorAll('.view-section').forEach((element) => element.classList.toggle('hidden', element.id !== `view-${view}`));
  document.querySelectorAll('.nav-item').forEach((element) => element.classList.toggle('active', element.dataset.view === view));
  byId('page-eyebrow').textContent = viewConfig[view][0];
  byId('page-title').textContent = viewConfig[view][1];
  if (showLoader) loading(true);
  try {
    await viewConfig[view][2]();
    byId('last-refresh').textContent = `Atualizado às ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`;
  } catch (error) {
    toast(error.message, true);
  } finally {
    loading(false);
  }
}

byId('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  byId('login-error').textContent = '';
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  try {
    if (formElement.dataset.step === 'request') {
      const email = String(form.get('email') || '').trim().toLowerCase();
      const result = await api('/api/login-request', { method: 'POST', body: JSON.stringify({ email }) });
      showCodeStep(email);
      toast(result.message || 'Código enviado. Confira seu e-mail.');
      return;
    }
    const result = await api('/api/login-verify', {
      method: 'POST', body: JSON.stringify({ email: state.loginEmail, code: String(form.get('code') || '').trim() }),
    });
    state.user = result.user;
    state.csrfToken = result.csrfToken;
    formElement.reset();
    resetLoginForm();
    showPortal();
  } catch (error) {
    byId('login-error').textContent = error.message;
  }
});

byId('change-email').addEventListener('click', () => resetLoginForm());
byId('resend-code').addEventListener('click', async () => {
  byId('login-error').textContent = '';
  try {
    const result = await api('/api/login-request', { method: 'POST', body: JSON.stringify({ email: state.loginEmail }) });
    byId('login-form').elements.code.value = '';
    byId('login-form').elements.code.focus();
    toast(result.message || 'Novo código solicitado.');
  } catch (error) {
    byId('login-error').textContent = error.message;
  }
});

async function logout() {
  try { await api('/api/logout', { method: 'POST', body: '{}' }); } catch { /* sessão já encerrada */ }
  showLogin();
}

byId('logout-button').addEventListener('click', logout);
byId('portal-logout').addEventListener('click', logout);

byId('portal-view').addEventListener('click', async (event) => {
  const area = event.target.closest('[data-area]');
  if (!area) return;
  area.dataset.state = 'loading';
  const selectedArea = area.dataset.area === 'campaigns' ? 'campaigns' : 'whatsapp';
  if (selectedArea === 'campaigns') state.campaignScreen = 'overview';
  showApp(selectedArea);
  await navigate(selectedArea === 'campaigns' ? 'campaigns' : 'overview');
  delete area.dataset.state;
});

byId('main-nav').addEventListener('click', (event) => {
  if (event.target.closest('[data-portal]')) return showPortal();
  const marketingView = event.target.closest('[data-marketing-view]');
  if (marketingView) {
    const screen = marketingView.dataset.marketingView;
    if (state.view !== 'campaigns') navigate('campaigns').then(() => setCampaignScreen(screen));
    else setCampaignScreen(screen);
    return;
  }
  const button = event.target.closest('[data-view]');
  if (button) navigate(button.dataset.view);
});

document.addEventListener('click', async (event) => {
  const openView = event.target.closest('[data-open-view]');
  if (openView) return navigate(openView.dataset.openView);
  const reviewFlag = event.target.closest('[data-review-flag]');
  if (reviewFlag) {
    event.preventDefault();
    event.stopPropagation();
    reviewFlag.disabled = true;
    const flagged = reviewFlag.dataset.flagged !== 'true';
    try {
      await api(`/api/conversations/${reviewFlag.dataset.reviewFlag}/review-flag`, { method: 'POST', body: JSON.stringify({ flagged }) });
      toast(flagged ? 'Conversa adicionada à fila de revisão.' : 'Conversa removida da fila de revisão.');
      if (state.view === 'quality') return loadQuality();
      if (state.view === 'conversations') return loadConversations();
      return loadOverview();
    } catch (error) {
      reviewFlag.disabled = false;
      return toast(error.message, true);
    }
  }
  const conversation = event.target.closest('[data-conversation-id]');
  if (conversation) return openConversation(conversation.dataset.conversationId);
  if (event.target.closest('[data-close-drawer]')) return closeDrawer();
  const page = event.target.closest('[data-page]');
  if (page && !page.disabled) { state.conversationPage = Number(page.dataset.page); return navigate('conversations'); }
  const candidate = event.target.closest('[data-candidate-id]');
  if (candidate) {
    try {
      await api(`/api/faq-candidates/${candidate.dataset.candidateId}`, { method: 'PATCH', body: JSON.stringify({ status: candidate.dataset.candidateStatus }) });
      toast(candidate.dataset.candidateStatus === 'accepted' ? 'Sugestão encaminhada para validação de fonte.' : 'Sugestão rejeitada.');
      return loadQuality();
    } catch (error) { return toast(error.message, true); }
  }
  const userButton = event.target.closest('[data-user-id]');
  if (userButton && !userButton.disabled) {
    try {
      await api(`/api/users/${userButton.dataset.userId}/active`, { method: 'PATCH', body: JSON.stringify({ active: userButton.dataset.userActive === 'true' }) });
      toast('Acesso atualizado.');
      return loadUsers();
    } catch (error) { return toast(error.message, true); }
  }
});

document.addEventListener('keydown', (event) => {
  const conversation = event.target.closest('tr[data-conversation-id]');
  if (conversation && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    openConversation(conversation.dataset.conversationId);
  }
});

byId('conversation-drawer').addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-review-conversation]');
  if (!form) return;
  event.preventDefault();
  const data = new FormData(form);
  try {
    await api('/api/conversation-review', {
      method: 'POST', body: JSON.stringify({
        conversationId: form.dataset.reviewConversation,
        rating: data.get('rating') || null, status: data.get('status'), notes: data.get('notes'), labels: data.getAll('labels'),
      }),
    });
    toast('Revisão salva e auditada.');
    await openConversation(form.dataset.reviewConversation);
  } catch (error) { toast(error.message, true); }
});

let searchTimer;
byId('conversation-search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.conversationPage = 1; navigate('conversations', false); }, 350);
});
['conversation-status', 'conversation-segment'].forEach((id) => byId(id).addEventListener('change', () => {
  state.conversationPage = 1;
  navigate('conversations', false);
}));

['campaign-days', 'campaign-status'].forEach((id) => byId(id).addEventListener('change', () => navigate('campaigns')));
byId('campaign-search').addEventListener('input', () => {
  if (state.campaignData) renderCampaignScreens(state.campaignData, byId('campaign-days').value);
});

byId('refresh-button').addEventListener('click', () => navigate(state.view));
byId('run-analysis').addEventListener('click', async () => {
  if (!window.confirm('Analisar somente as conversas marcadas? Dados de contato serão removidos e nenhuma FAQ será publicada automaticamente.')) return;
  try {
    await api('/api/analysis', { method: 'POST', body: '{}' });
    toast('Análise iniciada. Atualize esta página em alguns instantes.');
    await loadQuality();
  } catch (error) { toast(error.message, true); }
});

function exportReviews(format) {
  if (!['html', 'json'].includes(format)) return;
  window.location.assign(`/api/review-export?format=${format}`);
}

byId('export-reviews-html').addEventListener('click', () => exportReviews('html'));
byId('export-reviews-json').addEventListener('click', () => exportReviews('json'));

document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeDrawer(); });

(async function initialize() {
  try {
    const result = await api('/api/session');
    state.user = result.user;
    state.csrfToken = csrfFromCookie();
    showPortal();
  } catch {
    showLogin();
  }
}());
