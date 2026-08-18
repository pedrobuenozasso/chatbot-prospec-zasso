import { monitoringConfig } from './config.mjs';

const campaignStatuses = new Set(['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED', 'IN_PROCESS', 'WITH_ISSUES']);
const resultPriority = [
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.messaging_first_reply',
  'onsite_conversion.messaging_connection',
  'onsite_conversion.total_messaging_connection',
];
const cache = new Map();

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

function periodForDays(days) {
  const until = new Date();
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - days + 1);
  return { since: isoDay(since), until: isoDay(until) };
}

function resultFromActions(actions = []) {
  for (const actionType of resultPriority) {
    const action = actions.find((item) => item.action_type === actionType);
    if (action) return { value: number(action.value), actionType };
  }
  return { value: 0, actionType: null };
}

function insight(row = {}) {
  const result = resultFromActions(row.actions);
  return {
    spend: number(row.spend),
    impressions: number(row.impressions),
    reach: number(row.reach),
    frequency: number(row.frequency),
    clicks: number(row.clicks),
    ctr: number(row.ctr),
    cpc: number(row.cpc),
    cpm: number(row.cpm),
    results: result.value,
    resultActionType: result.actionType,
  };
}

function metaError(payload, status) {
  const code = payload?.error?.code || status;
  const error = new Error('A Meta não retornou os dados de campanhas agora. Atualize em alguns instantes.');
  error.statusCode = status === 429 ? 429 : 502;
  error.metaCode = code;
  return error;
}

async function graph(path, parameters = {}) {
  const url = new URL(`https://graph.facebook.com/${monitoringConfig.metaGraphVersion}/${path.replace(/^\//, '')}`);
  Object.entries(parameters).forEach(([key, value]) => {
    if (value != null && value !== '') url.searchParams.set(key, String(value));
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), monitoringConfig.metaTimeoutMs);
  try {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${monitoringConfig.metaAccessToken}`, accept: 'application/json' },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) throw metaError(payload, response.status);
    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('A consulta à Meta excedeu o tempo limite. Tente novamente.');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function insightParameters(period, extra = {}) {
  return {
    fields: 'account_currency,account_name,campaign_id,campaign_name,spend,impressions,reach,frequency,clicks,ctr,cpc,cpm,actions',
    time_range: JSON.stringify(period),
    action_report_time: 'conversion',
    use_account_attribution_setting: 'true',
    limit: 200,
    ...extra,
  };
}

function configured() {
  return Boolean(monitoringConfig.metaAccessToken && /^\d{6,30}$/.test(monitoringConfig.metaAdAccountId));
}

export async function campaignDashboard({ days = 30, status = '' } = {}) {
  const safeDays = [7, 14, 30, 90].includes(Number(days)) ? Number(days) : 30;
  const safeStatus = campaignStatuses.has(String(status).toUpperCase()) ? String(status).toUpperCase() : '';
  if (!configured()) {
    return {
      configured: false,
      accountId: monitoringConfig.metaAdAccountId ? `act_${monitoringConfig.metaAdAccountId}` : null,
      period: periodForDays(safeDays),
      totals: null,
      campaigns: [],
      daily: [],
      updatedAt: new Date().toISOString(),
    };
  }

  const key = `${safeDays}:${safeStatus}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cached: true };

  const account = `act_${monitoringConfig.metaAdAccountId}`;
  const period = periodForDays(safeDays);
  const [campaignResponse, totalResponse, campaignInsightResponse, dailyResponse] = await Promise.all([
    graph(`${account}/campaigns`, {
      fields: 'id,name,status,effective_status,objective,start_time,stop_time,updated_time',
      limit: 200,
    }),
    graph(`${account}/insights`, insightParameters(period)),
    graph(`${account}/insights`, insightParameters(period, { level: 'campaign' })),
    graph(`${account}/insights`, insightParameters(period, { time_increment: 1 })),
  ]);

  const metricsByCampaign = new Map((campaignInsightResponse.data || []).map((row) => [row.campaign_id, insight(row)]));
  const campaigns = (campaignResponse.data || []).map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    effectiveStatus: campaign.effective_status,
    objective: campaign.objective,
    startTime: campaign.start_time || null,
    stopTime: campaign.stop_time || null,
    updatedTime: campaign.updated_time || null,
    metrics: metricsByCampaign.get(campaign.id) || insight(),
  })).filter((campaign) => !safeStatus || campaign.effectiveStatus === safeStatus)
    .sort((a, b) => b.metrics.spend - a.metrics.spend);

  const totalInsight = insight(totalResponse.data?.[0]);
  const value = {
    configured: true,
    accountId: account,
    currency: totalResponse.data?.[0]?.account_currency || 'BRL',
    period,
    totals: {
      ...totalInsight,
      campaignCount: campaigns.length,
      activeCampaigns: campaigns.filter((campaign) => campaign.effectiveStatus === 'ACTIVE').length,
      costPerResult: totalInsight.results > 0 ? totalInsight.spend / totalInsight.results : null,
    },
    campaigns,
    daily: (dailyResponse.data || []).map((row) => ({
      date: row.date_start,
      ...insight(row),
    })),
    updatedAt: new Date().toISOString(),
    cached: false,
  };
  cache.set(key, { value, expiresAt: Date.now() + monitoringConfig.metaCacheSeconds * 1000 });
  return value;
}
