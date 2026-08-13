import { config } from './config.mjs';

export function canonicalCampaignMessage(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesWeekendCampaignMessage(
  text,
  expected = config.weekendHandoffCampaignMessage,
) {
  const supplied = canonicalCampaignMessage(text);
  const marker = canonicalCampaignMessage(expected);
  return Boolean(supplied && marker && supplied === marker);
}

export function localWeekday(now = new Date(), timezone = config.weekendHandoffTimezone) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone })
    .format(now)
    .toLocaleLowerCase('en-US');
}

export function captureWeekendCampaignEntry(state, {
  text,
  channel = 'whatsapp',
  now = new Date(),
  enabled = config.weekendHandoffEnabled,
} = {}) {
  if (!enabled || channel !== 'whatsapp' || state.stage !== 'new') return false;
  if (state.entrySource?.type && state.entrySource.type !== 'unknown') return false;
  if (!['fri', 'sat'].includes(localWeekday(now))) return false;
  if (!matchesWeekendCampaignMessage(text)) return false;

  state.entrySource = {
    type: 'ctwa_marker',
    detectedAt: now.toISOString(),
  };
  return true;
}
