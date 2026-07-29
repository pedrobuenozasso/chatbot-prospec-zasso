import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { config, projectRoot } from './config.mjs';

const outboxPath = resolve(projectRoot, '.outbox/salesforce-pending.jsonl');

function displaySegment(segment) {
  return segment === 'agro' ? 'Agronegócio' : 'Urbano';
}

function displayUrbanProfile(profile) {
  return { prefeitura: 'Prefeitura', prestador_de_servicos: 'Prestador de serviços', outro: 'Outro' }[profile] || 'Não informado';
}

export function leadPayload(state) {
  const { qualification, contact } = state;
  const details = [
    'Origem: Telegram',
    `Segmento: ${displaySegment(qualification.segment)}`,
    `Região: ${qualification.region}`,
    qualification.segment === 'agro' ? `Cultivo/aplicação: ${qualification.crop}` : `Perfil urbano: ${displayUrbanProfile(qualification.urbanProfile)}`,
    qualification.segment === 'agro' ? `Área: ${qualification.area}${qualification.areaHectares ? ` (${qualification.areaHectares} ha)` : ''}` : null,
  ].filter(Boolean).join('\n');

  return {
    FirstName: contact.firstName || undefined,
    LastName: contact.firstName || 'Lead Telegram',
    Company: qualification.segment === 'agro' ? 'Lead agro' : 'Lead urbano',
    Description: details,
  };
}

function enqueue(payload, reason) {
  mkdirSync(dirname(outboxPath), { recursive: true });
  appendFileSync(outboxPath, `${JSON.stringify({ createdAt: new Date().toISOString(), reason, payload })}\n`);
  return { status: 'queued' };
}

export async function sendLeadToSalesforce(state) {
  const payload = leadPayload(state);
  if (!config.salesforceInstanceUrl || !config.salesforceAccessToken) {
    return enqueue(payload, 'salesforce_not_configured');
  }

  try {
    const response = await fetch(`${config.salesforceInstanceUrl}/services/data/${config.salesforceApiVersion}/sobjects/Lead/`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.salesforceAccessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.success) return enqueue(payload, `salesforce_error_${response.status}`);
    return { status: 'sent', id: body.id };
  } catch {
    return enqueue(payload, 'salesforce_network_error');
  }
}
