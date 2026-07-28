"""Orquestra uma pergunta e devolve um ou mais balões de resposta."""
import logging
from dataclasses import dataclass, replace

from bot import ai_worker, memory, router, tone
from bot.config import Settings
from bot.prompt import SYSTEM_PROMPT, build_context
from bot.retrieval import search_chunks

logger = logging.getLogger(__name__)

_RETRIEVAL_LIMIT = 5
_MAX_GENERATION_ATTEMPTS = 3  # geração inicial + retry 1 + retry 2
_REACTION_ACTS = {
    "positive_reaction",
    "neutral_acknowledgment",
    "negative_reaction",
}

# Ponto de partida, não calibração final: baseado em amostra pequena e manual
# (pergunta legítima ~0.24, tentativa de extração ~0.43-0.59, xingamento
# ~0.65-0.68 — ver ai_worker_observations.md). Se começar a barrar pergunta
# legítima ou deixar passar lixo, é sinal de que precisa de um lote maior de
# teste por categoria pra recalibrar este número (ver debt.md).
_DISTANCE_THRESHOLD = 0.5
_FALLBACK_NO_CONTEXT = (
    "Não encontrei essa informação por aqui. Se quiser, posso deixar sua "
    "pergunta registrada para a equipe."
)


@dataclass(frozen=True)
class AnswerBatch:
    """Um turno pode produzir mais de um balão, mantendo cada função separada."""

    messages: tuple[str, ...]


def _response_metadata_with_generation(
    decision: router.RoutingDecision,
    attempts: list[dict[str, object]],
) -> dict[str, object]:
    metadata = router.response_metadata(decision)
    metadata["generation"] = {
        "attempt_count": len(attempts),
        "repaired": len(attempts) > 1,
        "attempts": attempts,
    }
    return metadata


def _generation_inputs(
    attempt_index: int,
    chunks: list,
    history: list[dict[str, str]],
) -> tuple[list, list[dict[str, str]]]:
    """Cada reparo reduz entrada para aumentar a folga da resposta."""
    if attempt_index == 0:
        return chunks, history
    if attempt_index == 1:
        return chunks[:5], history[-2:]
    return chunks[:3], []

# Comandos do Telegram (mensagens começando com "/") são instruções de protocolo,
# não perguntas — nunca devem ir pra busca vetorial (foi o que gerou o "/start"
# virando query e trazendo chunks aleatórios de segurança).
_COMMAND_RESPONSES = {
    "/start": (
        "Olá! Sou o assistente virtual da Zasso 🌱\n\n"
        "Posso te ajudar com perguntas sobre capina elétrica, nossos produtos, "
        "segurança, comparação com herbicidas e mais. É só perguntar!"
    ),
    "/help": (
        "É só escrever sua pergunta normalmente, em qualquer idioma, que eu respondo "
        "com base na nossa base de conhecimento sobre a Zasso e a tecnologia Electroherb."
    ),
}
_UNKNOWN_COMMAND = "Não reconheço esse comando. Pode escrever sua pergunta em texto normal?"


def handle_command(text: str) -> str | None:
    """Devolve a resposta pronta se `text` for um comando do Telegram, senão None."""
    if not text.startswith("/"):
        return None
    command = text.split()[0].split("@")[0]  # corta argumentos e sufixo @botname
    return _COMMAND_RESPONSES.get(command, _UNKNOWN_COMMAND)


def answer_messages(chat_id: int, question: str, settings: Settings) -> list[str]:
    result = _answer_question(chat_id, question, settings)
    messages = result.messages if isinstance(result, AnswerBatch) else (result,)
    return [tone.sanitize_reply(message) for message in messages]


def answer_question(chat_id: int, question: str, settings: Settings) -> str:
    """Compatibilidade para consumidores que ainda aceitam somente um balão."""
    return answer_messages(chat_id, question, settings)[0]


def _answer_question(
    chat_id: int,
    question: str,
    settings: Settings,
) -> str | AnswerBatch:
    state, window = memory.load_context(chat_id, settings)
    dialogue_history: list[dict[str, object]] = []
    generation_history: list[dict[str, str]] = []
    for message in window:
        generation_history.append(
            {"role": message.role, "content": message.content}
        )
        dialogue_item: dict[str, object] = {
            "role": message.role,
            "content": message.content,
        }
        if message.response_meta:
            dialogue_item["response_meta"] = message.response_meta
        dialogue_history.append(dialogue_item)

    # Pedido EXPLÍCITO de humano — prioridade máxima de handoff (2), checado
    # antes de tudo. Não é Q&A de conhecimento, mas entra no histórico textual e
    # PRECISA marcar o flag no banco.
    if router.is_human_handoff_request(question):
        memory.mark_handoff(chat_id, priority=2, reason="explicit_request", settings=settings)
        logger.info("[chat %s] handoff explícito solicitado: %r", chat_id, question)
        answer = router.pick_handoff_reply(state.language or "pt")
        memory.record_non_rag_turn(
            chat_id, state.session_id, question, answer, settings
        )
        return answer

    # Guardrails óbvios continuam locais. Eles não tentam decidir se uma frase é
    # saudação/reação — isso agora depende do classificador contextual.
    guardrail_answer = router.route_guardrail(question, state.language or "pt")
    if guardrail_answer is not None:
        memory.record_non_rag_turn(
            chat_id, state.session_id, question, guardrail_answer, settings
        )
        logger.info("[chat %s] guardrail local sem RAG: %r", chat_id, question)
        return guardrail_answer

    try:
        decision = router.classify_message(question, dialogue_history, settings)
    except ai_worker.AIWorkerError as exc:
        logger.warning("[chat %s] classificador conversacional falhou: %s", chat_id, exc)
        if router.ambiguous_acceptance(question, dialogue_history):
            offered_topics = (
                router.previous_offered_topics(dialogue_history)
                or router.default_guided_topics()
            )
            decision = router.RoutingDecision(
                language=state.language or "pt",
                act="positive_reaction",
                has_greeting=False,
                has_reaction=True,
                sentiment="positive",
                reaction_intensity="medium",
                has_question=False,
                needs_retrieval=False,
                topic_continuity=True,
                search_query="",
                requested_language=None,
                answer_depth="micro",
                core_goal="reconhecer a aceitação sem escolher pelo cliente",
                followup_mode="clarify_choice",
                offered_topics=offered_topics,
                warmth="warm",
                terminology_level="plain",
            )
        else:
            # Mantém os antigos atalhos exatos apenas como fallback offline. Fora
            # deles, a decisão conservadora preserva a mensagem como pergunta.
            routed_answer = router.route(question, state.language or "pt")
            if routed_answer is not None:
                memory.record_non_rag_turn(
                    chat_id, state.session_id, question, routed_answer, settings
                )
                return routed_answer
            decision = router.fallback_decision(question, state.language or "pt")

    if router.ambiguous_acceptance(
        question,
        dialogue_history,
    ):
        offered_topics = (
            router.previous_offered_topics(dialogue_history)
            or decision.offered_topics
            or router.default_guided_topics()
        )
        decision = replace(
            decision,
            act="positive_reaction",
            has_reaction=True,
            sentiment="positive",
            reaction_intensity="medium",
            has_question=False,
            needs_retrieval=False,
            topic_continuity=True,
            search_query="",
            answer_depth="micro",
            core_goal="reconhecer a aceitação sem escolher pelo cliente",
            followup_mode="clarify_choice",
            offered_topics=offered_topics,
            warmth="warm",
            terminology_level="plain",
        )

    language = memory.resolve_language(
        chat_id,
        question,
        state,
        window,
        settings,
        detected_language=decision.language,
        requested_language=decision.requested_language,
        act=decision.act,
    )
    if language != decision.language:
        decision = replace(decision, language=language)

    if decision.act == "handoff_request":
        memory.mark_handoff(chat_id, priority=2, reason="classified_request", settings=settings)
        answer = router.reply_without_retrieval(
            decision,
            question,
            dialogue_history,
        )
        memory.record_non_rag_turn(
            chat_id,
            state.session_id,
            question,
            answer,
            settings,
            response_meta=router.response_metadata(decision),
        )
        return answer

    if not decision.needs_retrieval:
        if decision.act in _REACTION_ACTS:
            try:
                answer = ai_worker.generate_reaction(
                    question,
                    decision.act,
                    decision.sentiment,
                    decision.reaction_intensity,
                    language,
                    dialogue_history,
                    settings,
                )
            except ai_worker.AIWorkerError as exc:
                logger.warning(
                    "[chat %s] geração contextual de reação falhou: %s; usando template.",
                    chat_id, exc,
                )
                answer = router.reply_without_retrieval(
                    decision,
                    question,
                    dialogue_history,
                )
        else:
            answer = router.reply_without_retrieval(
                decision,
                question,
                dialogue_history,
            )
        followup = router.render_followup(
            decision.followup_mode,
            decision.offered_topics,
            language,
        )
        if followup:
            answer = f"{answer.rstrip()} {followup}"
        answer = tone.adapt_reply_to_history(answer, dialogue_history)
        answer = tone.sanitize_reply(answer)
        memory.record_non_rag_turn(
            chat_id,
            state.session_id,
            question,
            answer,
            settings,
            response_meta=router.response_metadata(decision),
        )
        logger.info(
            "[chat %s] ato=%s sem RAG | sentimento=%s",
            chat_id, decision.act, decision.sentiment,
        )
        return answer

    # O classificador produz uma consulta autônoma, removendo saudações e reações.
    # Não concatenamos mais mensagens brutas: isso foi a causa da contaminação
    # observada no diálogo real.
    search_query = decision.search_query
    new_chunks = search_chunks(search_query, settings, limit=_RETRIEVAL_LIMIT)

    # O limiar decide relevância sobre a busca NOVA (chunks anteriores nunca
    # furam o gate — só enriquecem quando a busca nova já passou; estágio B).
    if not new_chunks:
        logger.warning("[chat %s] nenhum chunk para: %r", chat_id, search_query)
        memory.record_non_rag_turn(
            chat_id,
            state.session_id,
            question,
            _FALLBACK_NO_CONTEXT,
            settings,
            response_meta=router.response_metadata(
                replace(
                    decision,
                    followup_mode="none",
                    offered_topics=(),
                )
            ),
        )
        return _FALLBACK_NO_CONTEXT
    if new_chunks[0].distance > _DISTANCE_THRESHOLD:
        logger.info(
            "[chat %s] melhor distância acima do limiar (%.3f > %.3f) — sem RAG: %r",
            chat_id, new_chunks[0].distance, _DISTANCE_THRESHOLD, search_query,
        )
        memory.record_non_rag_turn(
            chat_id,
            state.session_id,
            question,
            _FALLBACK_NO_CONTEXT,
            settings,
            response_meta=router.response_metadata(
                replace(
                    decision,
                    followup_mode="none",
                    offered_topics=(),
                )
            ),
        )
        return _FALLBACK_NO_CONTEXT

    # Chunks anteriores só entram quando o classificador confirmou que a pergunta
    # depende do tópico anterior. Perguntas autônomas começam com contexto limpo.
    prev_chunks = (
        memory.load_last_assistant_chunks(chat_id, state.session_id, settings)
        if decision.topic_continuity
        else []
    )
    chunks = memory.merge_chunks(new_chunks, prev_chunks)

    logger.info(
        "[chat %s] ato=%s | idioma=%s | query=%r | janela=%d msgs | chunks=%s",
        chat_id, decision.act, language, search_query, len(window),
        ", ".join(f"{c.faq_id}/{c.section}({c.distance:.3f})" for c in chunks),
    )

    generation_attempts: list[dict[str, object]] = []
    generation_result: ai_worker.GenerationResult | None = None
    successful_chunks = chunks
    for attempt_index in range(_MAX_GENERATION_ATTEMPTS):
        attempt_chunks, attempt_history = _generation_inputs(
            attempt_index,
            chunks,
            generation_history,
        )
        attempt_context = build_context(attempt_chunks)
        try:
            candidate = ai_worker.generate(
                SYSTEM_PROMPT,
                attempt_context,
                search_query,
                language,
                settings,
                attempt_history,
                response_guidance=router.generation_guidance(decision, question),
                repair_attempt=attempt_index,
            )
        except ai_worker.AIWorkerError as exc:
            generation_attempts.append(
                {
                    "attempt": attempt_index + 1,
                    "outcome": "error",
                    "context_chunks": len(attempt_chunks),
                    "history_messages": len(attempt_history),
                }
            )
            logger.warning(
                "[chat %s] geração %d/%d falhou: %s",
                chat_id,
                attempt_index + 1,
                _MAX_GENERATION_ATTEMPTS,
                exc,
            )
            continue

        complete = ai_worker.is_complete_generation(candidate)
        generation_attempts.append(
            {
                "attempt": attempt_index + 1,
                "outcome": "complete" if complete else "incomplete",
                "job_id": candidate.job_id,
                "finish_reason": candidate.finish_reason,
                "input_tokens": candidate.input_tokens,
                "output_tokens": candidate.output_tokens,
                "context_chunks": len(attempt_chunks),
                "history_messages": len(attempt_history),
            }
        )
        if complete:
            generation_result = candidate
            successful_chunks = attempt_chunks
            break
        logger.warning(
            "[chat %s] geração %d/%d incompleta (job=%s, finish_reason=%s).",
            chat_id,
            attempt_index + 1,
            _MAX_GENERATION_ATTEMPTS,
            candidate.job_id,
            candidate.finish_reason,
        )

    if generation_result is None:
        # Nenhuma saída parcial entra na memória. A pergunta e o encaminhamento
        # ficam registrados para a equipe continuar com o contexto correto.
        handoff_decision = replace(
            decision,
            followup_mode="none",
            offered_topics=(),
        )
        answer = router.pick_generation_handoff_reply(language)
        memory.mark_handoff(
            chat_id,
            priority=2,
            reason="generation_failed_after_two_retries",
            settings=settings,
        )
        memory.record_non_rag_turn(
            chat_id,
            state.session_id,
            question,
            answer,
            settings,
            response_meta=_response_metadata_with_generation(
                handoff_decision,
                generation_attempts,
            ),
        )
        logger.error(
            "[chat %s] gerações esgotadas; pergunta encaminhada para atendimento humano.",
            chat_id,
        )
        return answer

    answer = router.make_confirmation_direct(
        question,
        generation_result.text,
        language,
    )
    prefix = router.composition_prefix(decision, question)
    if prefix:
        answer = f"{prefix} {answer.lstrip()}"

    # Engajamento (prioridade 1): checado com a contagem ANTES deste turno —
    # "3+ perguntas já respondidas e o cliente continua" (fechado com o dono do
    # projeto). Só dispara uma vez (mark_handoff nunca regride, e
    # should_offer_engagement_handoff já checa priority==0 antes de oferecer).
    engagement_note: str | None = None
    if memory.should_offer_engagement_handoff(state, settings):
        engagement_note = tone.sanitize_reply(router.pick_engagement_note(language))
        memory.mark_handoff(chat_id, priority=1, reason="engagement_threshold", settings=settings)
        logger.info("[chat %s] handoff por engajamento oferecido (limiar atingido).", chat_id)

    followup = router.render_followup(
        decision.followup_mode,
        decision.offered_topics,
        language,
    )
    if followup:
        answer = f"{answer.rstrip()}\n\n{followup}"

    # Só gravamos gerações bem-sucedidas: a janela carrega Q&A real que ajuda os
    # próximos turnos. Fallbacks/erros ficam de fora de propósito.
    answer = tone.adapt_reply_to_history(answer, dialogue_history)
    answer = tone.sanitize_reply(answer)
    memory.record_turn(
        chat_id,
        state.session_id,
        question,
        answer,
        successful_chunks,
        settings,
        response_meta=_response_metadata_with_generation(
            decision,
            generation_attempts,
        ),
        assistant_followups=(
            [
                (
                    engagement_note,
                    {
                        "act": "engagement_handoff_notice",
                        "handoff_priority": 1,
                    },
                )
            ]
            if engagement_note
            else None
        ),
    )
    if engagement_note:
        return AnswerBatch((answer, engagement_note))
    return answer
