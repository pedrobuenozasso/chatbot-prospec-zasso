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

export function weekendQueueDecision(state, {
  enabled = config.weekendHandoffEnabled,
  releaseAt = config.weekendHandoffReleaseAt,
} = {}) {
  if (!enabled || !['ctwa_marker', 'ctwa_referral'].includes(state.entrySource?.type)) {
    return { eligible: false, reason: 'source_not_eligible' };
  }

  const detectedAt = Date.parse(state.entrySource.detectedAt || '');
  const scheduledFor = Date.parse(releaseAt || '');
  if (!Number.isFinite(detectedAt) || !Number.isFinite(scheduledFor)) {
    return { eligible: false, reason: 'invalid_schedule' };
  }

  const freeEntryExpiresAt = detectedAt + 72 * 60 * 60 * 1000;
  if (scheduledFor <= detectedAt || scheduledFor >= freeEntryExpiresAt) {
    return { eligible: false, reason: 'outside_free_entry_window' };
  }

  return {
    eligible: true,
    reason: 'eligible',
    sourceType: state.entrySource.type,
    firstInboundAt: new Date(detectedAt).toISOString(),
    scheduledFor: new Date(scheduledFor).toISOString(),
    freeEntryExpiresAt: new Date(freeEntryExpiresAt).toISOString(),
  };
}
