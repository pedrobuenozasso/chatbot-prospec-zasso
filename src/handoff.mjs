import { appendFileSync, chmodSync, existsSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname } from 'node:path';
import { config } from './config.mjs';
import { normalizeLanguage, t } from './i18n.mjs';

const outboxPath = config.handoffOutboxPath;

function displaySegment(segment) {
  if (segment === 'agro') return 'Agronegócio';
  if (segment === 'urban') return 'Urbano';
  return 'Não informado';
}

function displayUrbanProfile(profile) {
  return { prefeitura: 'Prefeitura', prestador_de_servicos: 'Prestador de serviços', outro: 'Outro' }[profile] || 'Não informado';
}

function createProtocol() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `ZAS-${date}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

function safeLine(value, maximumLength = 180) {
  return String(value || '')
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function localizedSegment(segment, language) {
  if (segment === 'agro') return t(language, 'summarySegmentAgro');
  if (segment === 'urban') return t(language, 'summarySegmentUrban');
  return '';
}

function localizedUrbanProfile(profile, language) {
  const key = {
    prefeitura: 'summaryUrbanMunicipality',
    prestador_de_servicos: 'summaryUrbanServiceProvider',
    outro: 'summaryUrbanOther',
  }[profile];
  return key ? t(language, key) : '';
}

function commercialMessage(state) {
  const language = normalizeLanguage(state.language);
  const qualification = state.qualification || {};
  const interests = [...new Set([
    state.initialInterest,
    ...(Array.isArray(state.interests) ? state.interests : []),
  ].map((value) => safeLine(value)).filter(Boolean))].join(' | ');
  const lines = [
    t(language, 'commercialPrefillIntro'),
    '',
    t(language, 'commercialSummaryTitle'),
    qualification.segment
      ? `• ${t(language, 'commercialSummarySegment')}: ${localizedSegment(qualification.segment, language)}`
      : null,
    qualification.region
      ? `• ${t(language, 'commercialSummaryRegion')}: ${safeLine(qualification.region)}`
      : null,
    qualification.segment === 'agro' && qualification.crop
      ? `• ${t(language, 'commercialSummaryCrop')}: ${safeLine(qualification.crop)}`
      : null,
    qualification.segment === 'agro' && qualification.area
      ? `• ${t(language, 'commercialSummaryArea')}: ${safeLine(qualification.area)}`
      : null,
    qualification.segment === 'urban' && qualification.urbanProfile
      ? `• ${t(language, 'commercialSummaryUrbanProfile')}: ${localizedUrbanProfile(qualification.urbanProfile, language)}`
      : null,
    qualification.segment === 'urban' && qualification.urbanScale
      ? `• ${t(language, 'commercialSummaryScale')}: ${safeLine(qualification.urbanScale)}`
      : null,
    interests
      ? `• ${t(language, 'commercialSummaryInterest')}: ${safeLine(interests)}`
      : null,
    '',
    `${t(language, 'commercialSummaryProtocol')}: ${safeLine(state.handoffProtocol, 40)}`,
  ];
  return lines.filter((line) => line !== null).join('\n');
}

export function commercialHandoff(state) {
  const number = config.commercialWhatsAppNumber;
  if (!/^\d{10,15}$/.test(number)) {
    throw new Error('COMMERCIAL_WHATSAPP_NUMBER deve conter de 10 a 15 dígitos no formato internacional.');
  }
  if (!state.handoffProtocol) {
    throw new Error('O protocolo deve ser criado antes do link comercial.');
  }
  const message = commercialMessage(state);
  return {
    number,
    message,
    url: `https://wa.me/${number}?text=${encodeURIComponent(message)}`,
  };
}

// Contrato temporário do MVP. No painel próprio, estes dados passarão a ser
// lidos do banco e aparecerão na fila de atendimento do comercial.
export function qualifiedLeadSummary(state) {
  const { qualification, contact } = state;
  const interests = [...new Set([
    state.initialInterest,
    ...(Array.isArray(state.interests) ? state.interests : []),
  ].map((value) => safeLine(value)).filter(Boolean))].join(' | ');
  return {
    protocol: state.handoffProtocol || null,
    contactName: contact.firstName || 'Lead',
    segment: displaySegment(qualification.segment),
    region: qualification.region,
    cropOrApplication: qualification.segment === 'agro' ? qualification.crop : null,
    area: qualification.segment === 'agro' ? qualification.area : null,
    areaHectares: qualification.segment === 'agro' ? qualification.areaHectares : null,
    urbanProfile: qualification.segment === 'urban' ? displayUrbanProfile(qualification.urbanProfile) : null,
    urbanScale: qualification.segment === 'urban' ? safeLine(qualification.urbanScale) || null : null,
    interest: safeLine(interests),
    partial: state.partialHandoff === true,
  };
}

export function queueQualifiedLead(state) {
  state.handoffProtocol ||= createProtocol();
  const summary = qualifiedLeadSummary(state);
  mkdirSync(dirname(outboxPath), { recursive: true, mode: 0o700 });
  appendFileSync(outboxPath, `${JSON.stringify({ queuedAt: new Date().toISOString(), summary })}\n`, { mode: 0o600 });
  chmodSync(outboxPath, 0o600);
  return {
    status: 'queued',
    protocol: state.handoffProtocol,
    summary,
    commercial: commercialHandoff(state),
  };
}

export function secureHandoffStorage() {
  if (existsSync(outboxPath)) chmodSync(outboxPath, 0o600);
}
