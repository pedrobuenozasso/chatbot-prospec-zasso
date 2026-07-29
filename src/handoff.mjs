import { appendFileSync, chmodSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { projectRoot } from './config.mjs';

const outboxPath = resolve(projectRoot, '.outbox/qualified-leads.jsonl');

function displaySegment(segment) {
  return segment === 'agro' ? 'Agronegócio' : 'Urbano';
}

function displayUrbanProfile(profile) {
  return { prefeitura: 'Prefeitura', prestador_de_servicos: 'Prestador de serviços', outro: 'Outro' }[profile] || 'Não informado';
}

// Contrato temporário do MVP. No painel próprio, estes dados passarão a ser
// lidos do banco e aparecerão na fila de atendimento do comercial.
export function qualifiedLeadSummary(state) {
  const { qualification, contact } = state;
  return {
    contactName: contact.firstName || 'Lead',
    segment: displaySegment(qualification.segment),
    region: qualification.region,
    cropOrApplication: qualification.segment === 'agro' ? qualification.crop : null,
    area: qualification.segment === 'agro' ? qualification.area : null,
    areaHectares: qualification.segment === 'agro' ? qualification.areaHectares : null,
    urbanProfile: qualification.segment === 'urban' ? displayUrbanProfile(qualification.urbanProfile) : null,
  };
}

export function queueQualifiedLead(state) {
  const summary = qualifiedLeadSummary(state);
  mkdirSync(dirname(outboxPath), { recursive: true, mode: 0o700 });
  appendFileSync(outboxPath, `${JSON.stringify({ queuedAt: new Date().toISOString(), summary })}\n`, { mode: 0o600 });
  chmodSync(outboxPath, 0o600);
  return { status: 'queued', summary };
}

export function secureHandoffStorage() {
  if (existsSync(outboxPath)) chmodSync(outboxPath, 0o600);
}
