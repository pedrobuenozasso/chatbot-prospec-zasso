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
import {
  captureWeekendCampaignEntry,
  shouldDeferCommercialHandoff,
  weekendQueueDecision,
} from './weekend-pilot.mjs';

const RESET_COMMANDS = new Set(['/start', '/reset', '/restart', '/reiniciar', '/neustart', '/recommencer']);
const STOP_COMMANDS = /^(?:\/stop|parar|cancelar|n[aã]o quero mais|stop|cancel|unsubscribe)$/iu;
const HUMAN_HANDOFF_REQUEST = /\b(?:quero|gostaria|preciso|posso|pode|quero falar|falar)\b.{0,45}\b(?:algu[eé]m|pessoa|atendente|humano|comercial|vendedor)|\b(?:speak|talk|connect|transfer)\b.{0,35}\b(?:someone|person|human|agent|sales(?:person| team)?)|\b(?:mit|zu)\b.{0,30}\b(?:jemandem|person|mitarbeiter|berater|vertrieb)\b.{0,25}\b(?:sprechen|verbinden)|\b(?:parler|passer|transf[eé]rer|mettre en contact)\b.{0,35}\b(?:quelqu['’]?un|personne|conseiller|humain|commercial)|\b(?:hablar|p[aá]same|pasarme|conectar|transferir)\b.{0,35}\b(?:alguien|persona|asesor|humano|comercial|vendedor)/iu;
const FRUSTRATION_PATTERN = /\b(?:de novo a mesma pergunta|mesma pergunta|j[aá] respondi|est[aá] repetindo|again the same question|same question again|i already answered|gleiche frage|schon beantwortet|m[eê]me question|d[eé]j[aà] r[eé]pondu|misma pregunta|ya respond[ií])\b/iu;

function safeInterest(value) {
  return String(value || '')
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function rememberInterest(state, text) {
  const interest = safeInterest(text);
  if (!interest) return;
  state.interests ||= [];
  if (interest !== state.initialInterest && !state.interests.includes(interest)) {
    state.interests.push(interest);
    state.interests = state.interests.slice(-5);
  }
}

function rememberUrbanScale(state, text) {
  if (state.qualification?.segment !== 'urban') return;
  const value = safeInterest(text);
  if (!/\b(?:\d[\d.,\s]*\s*(?:alqueires?|lotes?|m\s*(?:2|²)|metros? quadrados?|hectares?|ha)|mil\s+lotes?)\b/iu.test(value)) return;
  state.qualification.urbanScale = value;
}

function qualificationReady(state) {
  const qualification = state.qualification || {};
  if (!['agro', 'urban'].includes(qualification.segment) || !qualification.region) return false;
  if (qualification.segment === 'urban') return Boolean(qualification.urbanProfile);
  return Boolean(
    qualification.crop
    && qualification.area
    && Number.isFinite(qualification.areaHectares)
    && qualification.areaConfidence === 'high',
  );
}

function stageExamples(stage, language) {
  const examples = {
    segment: {
      'pt-BR': 'agronegócio ou área urbana', 'pt-PT': 'agricultura ou área urbana', 'en-US': 'agriculture or urban',
      'de-DE': 'Landwirtschaft oder städtischer Bereich', 'fr-FR': 'agriculture ou zone urbaine', 'es-ES': 'agricultura o área urbana',
    },
    region: {
      'pt-BR': 'Campinas/SP ou Portugal', 'pt-PT': 'Lisboa ou Porto', 'en-US': 'London or Texas',
      'de-DE': 'Berlin oder Bayern', 'fr-FR': 'Lyon ou Bretagne', 'es-ES': 'Valencia o Galicia',
    },
    agro_crop: {
      'pt-BR': 'café, soja ou citros', 'pt-PT': 'vinha, olival ou milho', 'en-US': 'wheat, soy or citrus',
      'de-DE': 'Weizen, Mais oder Wein', 'fr-FR': 'vigne, blé ou maïs', 'es-ES': 'cítricos, olivar o trigo',
    },
    agro_area: {
      'pt-BR': '20 hectares ou 200.000 m²', 'pt-PT': '20 hectares ou 200.000 m²', 'en-US': '20 hectares or 200,000 m²',
      'de-DE': '20 Hektar oder 200.000 m²', 'fr-FR': '20 hectares ou 200 000 m²', 'es-ES': '20 hectáreas o 200.000 m²',
    },
    urban_profile: {
      'pt-BR': 'prefeitura, prestador de serviços ou outro', 'pt-PT': 'câmara municipal/junta de freguesia, prestador de serviços ou outro',
      'en-US': 'municipality, service provider or other', 'de-DE': 'Gemeinde, Dienstleister oder Sonstiges',
      'fr-FR': 'municipalité, prestataire ou autre', 'es-ES': 'ayuntamiento, prestador de servicios u otro',
    },
  };
  return examples[stage]?.[normalizeLanguage(language)] || examples[stage]?.['pt-BR'] || '';
}

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

async function finishQualification(conversationId, state, { channel = 'whatsapp', now = new Date(), partial = false } = {}) {
  if (['queued', 'weekend_queued', 'weekend_deferred', 'weekend_template_sent', 'commercial_cta_sent'].includes(state.handoffStatus)
    && state.handoffProtocol) {
    return {
      status: state.handoffStatus,
      protocol: state.handoffProtocol,
      commercial: commercialHandoff(state),
    };
  }
  if (!partial && !qualificationReady(state)) {
    return { status: 'validation_failed', protocol: null, commercial: null };
  }
  state.partialHandoff = partial;
  const result = queueQualifiedLead(state);
  const weekend = weekendQueueDecision(state);
  if (weekend.eligible) {
    state.handoffStatus = 'weekend_queued';
    state.weekendHandoff = weekend;
    result.status = 'weekend_queued';
  } else if (shouldDeferCommercialHandoff({ channel, now })) {
    state.handoffStatus = 'weekend_deferred';
    state.weekendHandoff = { eligible: false, reason: weekend.reason };
    result.status = 'weekend_deferred';
  } else {
    state.handoffStatus = result.status;
  }
  recordEvent('lead_qualified', {
    conversationFingerprint: identifierFingerprint(conversationId),
    segment: state.qualification.segment,
    partial,
    handoffStatus: result.status,
  });
  return result;
}

function completedMessages(state, acknowledgement, handoff, contentAnswer = '', partial = false) {
  const confirmation = partial
    ? t(state.language, 'partialHandoff')
    : `${acknowledgement} ${t(state.language, 'completed')}`.trim();
  if (handoff.status === 'weekend_queued') {
    return [contentAnswer, confirmation, t(state.language, 'weekendQueued')].filter(Boolean);
  }
  if (handoff.status === 'weekend_deferred') {
    return [contentAnswer, confirmation, t(state.language, 'weekendDeferred')].filter(Boolean);
  }
  return [
    contentAnswer,
    confirmation,
    `${t(state.language, 'commercialCta')}\n\n${handoff.commercial.url}`,
  ].filter(Boolean);
}

async function partialHandoff(conversationId, state, messageId, { channel, now, explicit = false } = {}) {
  state.stage = STAGES.COMPLETED;
  const handoff = await finishQualification(conversationId, state, { channel, now, partial: true });
  saveProgress(conversationId, state, messageId);
  return response(state, completedMessages(
    state,
    '',
    handoff,
    explicit ? t(state.language, 'humanHandoff') : '',
    true,
  ), { qualified: false, partialHandoff: true });
}

async function handleInvalidReply(conversationId, state, messageId, cleanedText, { channel, now } = {}) {
  const stage = state.stage;
  state.qualificationAttempts ||= {};
  const attempts = Math.min((state.qualificationAttempts[stage] || 0) + 1, 3);
  state.qualificationAttempts[stage] = attempts;
  if (attempts >= 3) return partialHandoff(conversationId, state, messageId, { channel, now });

  const apology = FRUSTRATION_PATTERN.test(cleanedText) ? t(state.language, 'qualificationFrustration') : '';
  const prompt = attempts === 1
    ? qualificationQuestion(stage, state.language)
    : t(state.language, 'qualificationSecondTry', { examples: stageExamples(stage, state.language) });
  saveProgress(conversationId, state, messageId);
  return response(state, [apology, prompt].filter(Boolean));
}

export async function processInboundMessage({
  conversationId,
  messageId = '',
  text = '',
  firstName = '',
  language = 'pt-BR',
  eventType = 'message',
  channel = 'whatsapp',
  now = new Date(),
}) {
  const languageHint = normalizeLanguage(language);
  const cleanedText = String(text).trim();
  let state = getConversation(conversationId, { firstName, language: languageHint });

  // Marca somente a primeira mensagem de uma conversa nova. O marcador não é
  // suficiente para disparar nada sozinho: a fila e o template continuam
  // protegidos pela feature flag e pelas validações do piloto.
  captureWeekendCampaignEntry(state, { text: cleanedText, channel, now });

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
    if (state.handoffStatus === 'weekend_deferred') {
      if (shouldDeferCommercialHandoff({ channel, now })) {
        saveProgress(conversationId, state, messageId);
        return response(state, [t(state.language, 'weekendDeferred')]);
      }
      const commercial = commercialHandoff(state);
      state.handoffStatus = 'commercial_cta_sent';
      saveProgress(conversationId, state, messageId);
      return response(state, [`${t(state.language, 'commercialCta')}\n\n${commercial.url}`], {
        weekendResumed: true,
      });
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

  rememberUrbanScale(state, cleanedText);

  if (state.stage !== STAGES.COMPLETED && HUMAN_HANDOFF_REQUEST.test(cleanedText)) {
    rememberInterest(state, cleanedText);
    return partialHandoff(conversationId, state, messageId, { channel, now, explicit: true });
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
      rememberInterest(state, compound.question);
      const result = await answer(compound.question, state.language);
      state.language = result.language;
      const progress = advanceQualification(state, compound.answer, result.language);
      rememberUrbanScale(progress.state, compound.answer);
      progress.state.qualificationAttempts ||= {};
      progress.state.qualificationAttempts[state.stage] = 0;
      const contentAnswer = `${result.answer}${sourceList(result.sources, result.language)}`.slice(0, 4000);

      if (progress.completed) {
        const handoff = await finishQualification(conversationId, progress.state, { channel, now });
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
      rememberInterest(state, cleanedText);
      const result = await answer(cleanedText, state.language);
      state.language = result.language;
      saveProgress(conversationId, state, messageId);
      return response(state, [
        `${result.answer}${sourceList(result.sources, result.language)}`.slice(0, 4000),
        qualificationQuestion(state.stage, result.language),
      ]);
    }
    if (assessment.kind === 'invalid') {
      return handleInvalidReply(conversationId, state, messageId, cleanedText, { channel, now });
    }

    const previousStage = state.stage;
    const progress = advanceQualification(state, cleanedText, state.language);
    rememberUrbanScale(progress.state, cleanedText);
    if (progress.state.stage === previousStage && !progress.completed) {
      return handleInvalidReply(conversationId, progress.state, messageId, cleanedText, { channel, now });
    }
    progress.state.qualificationAttempts ||= {};
    progress.state.qualificationAttempts[previousStage] = 0;
    if (progress.completed) {
      const handoff = await finishQualification(conversationId, progress.state, { channel, now });
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
