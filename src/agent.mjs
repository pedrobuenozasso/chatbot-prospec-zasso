import {
  advanceQualification,
  getConversation,
  qualificationQuestion,
  resetConversation,
  saveConversation,
  STAGES,
} from './conversation.mjs';
import { config } from './config.mjs';
import { commercialHandoff, queueQualifiedLead } from './handoff.mjs';
import { normalizeLanguage, t } from './i18n.mjs';
import { identifierFingerprint, recordEvent } from './observability.mjs';
import { answer, assessQualificationReply, isPromptInjection, partitionQualificationMessage } from './rag.mjs';
import { captureWeekendCampaignEntry, weekendQueueDecision } from './weekend-pilot.mjs';

const RESET_COMMANDS = new Set(['/start', '/reset', '/restart', '/reiniciar', '/neustart', '/recommencer']);
const STOP_COMMANDS = /^(?:\/stop|parar|cancelar|n[aã]o quero mais|stop|cancel|unsubscribe)$/iu;

function sourceList(sources, language) {
  if (!config.showSources || !sources.length) return '';
  return `\n\n${t(language, 'sourceLabel')}: ${sources.map((source) => source.faqId).join(', ')}`;
}

function needsGreeting(state, answerText) {
  return !state.greeted && !/^(olá|oi|bom dia|boa tarde|boa noite|hello|hi|good morning|good afternoon|good evening|hallo|guten|bonjour|salut|bonsoir|hola|buenos|buenas)/iu.test(answerText);
}

function humanizedProgress(progress) {
  return [progress.acknowledgement, progress.nextQuestion].filter(Boolean).join(' ');
}

function rememberInitialInterest(state, text) {
  if (state.initialInterest) return;
  const cleaned = String(text)
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  if (!cleaned) return;
  const genericOpening = /^(ol[aá]|oi|bom dia|boa tarde|boa noite|hello|hi|hey|good (morning|afternoon|evening)|hallo|guten tag|bonjour|salut|bonsoir|hola|buenos d[ií]as|buenas tardes|buenas noches)[!. ]*$/iu;
  const qualificationOnly = /^(agro|agroneg[oó]cio|agriculture|landwirtschaft|agricultura|urbano|urbana|urban|urbain|st[aä]dtisch)[!. ]*$/iu;
  const smallTalkOpening = /^(ol[aá]|oi|hello|hi|hey|hallo|bonjour|salut|hola)[,!. ]+(tudo bem|como vai|how are you|wie geht'?s|comment allez-vous|ça va|como est[aá]s)[?!. ]*$/iu;
  if (!genericOpening.test(cleaned) && !smallTalkOpening.test(cleaned) && !qualificationOnly.test(cleaned)) {
    state.initialInterest = cleaned;
  }
}

function messageFingerprint(messageId) {
  return messageId ? identifierFingerprint(`message:${messageId}`) : null;
}

function isDuplicate(state, messageId) {
  const fingerprint = messageFingerprint(messageId);
  return fingerprint && (state.recentMessageFingerprints || []).includes(fingerprint);
}

function rememberMessage(state, messageId) {
  const fingerprint = messageFingerprint(messageId);
  if (!fingerprint) return;
  state.recentMessageFingerprints = [
    ...(state.recentMessageFingerprints || []).filter((value) => value !== fingerprint),
    fingerprint,
  ].slice(-50);
}

function saveProgress(conversationId, state, messageId) {
  rememberMessage(state, messageId);
  saveConversation(conversationId, state);
}

function response(state, messages, extra = {}) {
  return {
    duplicate: false,
    messages: messages.filter(Boolean),
    language: state.language,
    stage: state.stage,
    handoffStatus: state.handoffStatus,
    ...extra,
  };
}

async function finishQualification(conversationId, state) {
  if (['queued', 'weekend_queued', 'weekend_template_sent', 'commercial_cta_sent'].includes(state.handoffStatus)
    && state.handoffProtocol) {
    return {
      status: state.handoffStatus,
      protocol: state.handoffProtocol,
      commercial: commercialHandoff(state),
    };
  }
  const result = queueQualifiedLead(state);
  const weekend = weekendQueueDecision(state);
  if (weekend.eligible) {
    state.handoffStatus = 'weekend_queued';
    state.weekendHandoff = weekend;
    result.status = 'weekend_queued';
  } else {
    state.handoffStatus = result.status;
  }
  recordEvent('lead_qualified', {
    conversationFingerprint: identifierFingerprint(conversationId),
    segment: state.qualification.segment,
    handoffStatus: result.status,
  });
  return result;
}

function completedMessages(state, acknowledgement, handoff, contentAnswer = '') {
  const confirmation = `${acknowledgement} ${t(state.language, 'completed')}`.trim();
  if (handoff.status === 'weekend_queued') {
    return [contentAnswer, confirmation, t(state.language, 'weekendQueued')].filter(Boolean);
  }
  return [
    contentAnswer,
    confirmation,
    `${t(state.language, 'commercialCta')}\n\n${handoff.commercial.url}`,
  ].filter(Boolean);
}

export async function processInboundMessage({
  conversationId,
  messageId = '',
  text = '',
  firstName = '',
  language = 'pt-BR',
  eventType = 'message',
  channel = 'whatsapp',
}) {
  const languageHint = normalizeLanguage(language);
  const cleanedText = String(text).trim();
  let state = getConversation(conversationId, { firstName, language: languageHint });

  // Marca somente a primeira mensagem de uma conversa nova. O marcador não é
  // suficiente para disparar nada sozinho: a fila e o template continuam
  // protegidos pela feature flag e pelas validações do piloto.
  captureWeekendCampaignEntry(state, { text: cleanedText, channel });

  if (isDuplicate(state, messageId)) {
    recordEvent('duplicate_message_ignored', {
      conversationFingerprint: identifierFingerprint(conversationId),
      messageFingerprint: messageFingerprint(messageId),
    });
    return { duplicate: true, messages: [], language: state.language, stage: state.stage, handoffStatus: state.handoffStatus };
  }

  if (eventType === 'call') {
    saveProgress(conversationId, state, messageId);
    recordEvent('incoming_call_redirected_to_text', {
      conversationFingerprint: identifierFingerprint(conversationId),
    });
    return response(state, [t(state.language || languageHint, 'callUnsupported')], { callRedirected: true });
  }

  const command = cleanedText.toLocaleLowerCase();
  if (RESET_COMMANDS.has(command)) {
    const resetLanguage = state.language || languageHint;
    resetConversation(conversationId);
    state = getConversation(conversationId, { firstName, language: resetLanguage });
    rememberMessage(state, messageId);
    saveConversation(conversationId, state);
    return response(state, [`${t(resetLanguage, 'welcome')}\n\n${t(resetLanguage, 'reset')}`], { reset: true });
  }
  if (state.stage === STAGES.COMPLETED) {
    if (STOP_COMMANDS.test(command) && ['weekend_queued', 'weekend_template_sent'].includes(state.handoffStatus)) {
      state.handoffStatus = 'weekend_cancelled';
      saveProgress(conversationId, state, messageId);
      recordEvent('weekend_handoff_cancelled', {
        conversationFingerprint: identifierFingerprint(conversationId),
      });
      return response(state, [t(state.language, 'weekendCancelled')]);
    }
    if (state.handoffStatus === 'weekend_template_sent') {
      const commercial = commercialHandoff(state);
      state.handoffStatus = 'commercial_cta_sent';
      saveProgress(conversationId, state, messageId);
      recordEvent('weekend_handoff_resumed', {
        conversationFingerprint: identifierFingerprint(conversationId),
      });
      return response(state, [`${t(state.language, 'commercialCta')}\n\n${commercial.url}`], {
        weekendResumed: true,
      });
    }
    if (state.handoffStatus === 'weekend_queued') {
      saveProgress(conversationId, state, messageId);
      return response(state, [t(state.language, 'weekendWaiting')]);
    }
    saveProgress(conversationId, state, messageId);
    recordEvent('post_handoff_redirected', {
      conversationFingerprint: identifierFingerprint(conversationId),
      handoffStatus: state.handoffStatus,
    });
    return response(state, [t(state.language, 'postHandoffReminder')]);
  }
  if (command === '/help') {
    rememberMessage(state, messageId);
    saveConversation(conversationId, state);
    return response(state, [t(state.language, 'welcome')]);
  }
  if (command === '/examples') {
    rememberMessage(state, messageId);
    saveConversation(conversationId, state);
    return response(state, [t(state.language, 'examples')]);
  }
  if (!cleanedText) {
    rememberMessage(state, messageId);
    saveConversation(conversationId, state);
    return response(state, [t(state.language, 'textOnly')]);
  }

  if (state.stage !== STAGES.NEW && state.stage !== STAGES.COMPLETED) {
    if (isPromptInjection(cleanedText)) {
      const blocked = await answer(cleanedText, state.language);
      saveProgress(conversationId, state, messageId);
      return response(state, [blocked.answer, qualificationQuestion(state.stage, state.language)]);
    }

    const compound = partitionQualificationMessage(state.stage, cleanedText);
    if (compound) {
      rememberInitialInterest(state, compound.question);
      const result = await answer(compound.question, state.language);
      state.language = result.language;
      const progress = advanceQualification(state, compound.answer, result.language);
      const contentAnswer = `${result.answer}${sourceList(result.sources, result.language)}`.slice(0, 4000);

      if (progress.completed) {
        const handoff = await finishQualification(conversationId, progress.state);
        saveProgress(conversationId, progress.state, messageId);
        return response(
          progress.state,
          completedMessages(progress.state, progress.acknowledgement, handoff, contentAnswer),
          { qualified: true },
        );
      }

      saveProgress(conversationId, progress.state, messageId);
      return response(progress.state, [contentAnswer, humanizedProgress(progress)]);
    }

    const assessment = await assessQualificationReply(state.stage, cleanedText, state.language);
    if (assessment.kind === 'question') {
      rememberInitialInterest(state, cleanedText);
      const result = await answer(cleanedText, state.language);
      state.language = result.language;
      saveProgress(conversationId, state, messageId);
      return response(state, [
        `${result.answer}${sourceList(result.sources, result.language)}`.slice(0, 4000),
        qualificationQuestion(state.stage, result.language),
      ]);
    }
    if (assessment.kind === 'invalid') {
      saveProgress(conversationId, state, messageId);
      return response(state, [qualificationQuestion(state.stage, state.language)]);
    }

    const progress = advanceQualification(state, cleanedText, state.language);
    if (progress.completed) {
      const handoff = await finishQualification(conversationId, progress.state);
      saveProgress(conversationId, progress.state, messageId);
      return response(
        progress.state,
        completedMessages(progress.state, progress.acknowledgement, handoff),
        { qualified: true },
      );
    }
    saveProgress(conversationId, progress.state, messageId);
    return response(progress.state, [humanizedProgress(progress)]);
  }

  const result = await answer(cleanedText, state.language);
  if (!isPromptInjection(cleanedText)) rememberInitialInterest(state, cleanedText);
  state.language = result.language;
  const reply = needsGreeting(state, result.answer)
    ? `${t(result.language, 'greeting')} ${result.answer}`
    : result.answer;
  state.greeted = true;

  state.stage = STAGES.SEGMENT;
  saveProgress(conversationId, state, messageId);
  return response(state, [
    `${reply}${sourceList(result.sources, result.language)}`.slice(0, 4000),
    qualificationQuestion(STAGES.SEGMENT, result.language),
  ]);
}
