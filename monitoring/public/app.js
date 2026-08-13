const state = {
  user: null,
  csrfToken: '',
  view: 'overview',
  conversationPage: 1,
  conversationLimit: 30,
  loginEmail: '',
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

function showApp() {
  byId('login-view').classList.add('hidden');
  byId('app-view').classList.remove('hidden');
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
  return rows.map((row) => `<div class="bar-row"><strong>${escapeHtml(friendly(row.label))}</strong><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, (Number(row.value) || 0) / maximum * 100)}%"></div></div><b>${Number(row.value) || 0}</b></div>`).join('');
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

const viewConfig = {
  overview: ['OPERAÇÃO EM TEMPO REAL', 'Visão geral', loadOverview],
  conversations: ['HISTÓRICO E REVISÃO', 'Conversas', loadConversations],
  quality: ['MELHORIA CONTROLADA', 'Revisões e FAQs', loadQuality],
  security: ['CONTROLE E AUDITORIA', 'Segurança', loadSecurity],
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
    showApp();
    await navigate('overview');
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

byId('logout-button').addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST', body: '{}' }); } catch { /* sessão já encerrada */ }
  showLogin();
});

byId('main-nav').addEventListener('click', (event) => {
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
      await api('/api/conversation-review', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: reviewFlag.dataset.reviewFlag,
          status: flagged ? 'needs_action' : 'resolved',
          labels: flagged ? ['needs_human_review'] : [],
        }),
      });
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
    showApp();
    await navigate('overview');
  } catch {
    showLogin();
  }
}());
