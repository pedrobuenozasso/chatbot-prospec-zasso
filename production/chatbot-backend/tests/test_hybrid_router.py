import unittest
from contextlib import ExitStack
from types import SimpleNamespace
from unittest.mock import patch
from uuid import UUID

import httpx

from bot import ai_worker, handler, router, tone
from bot.retrieval import RetrievedChunk


def _raw_classification(**overrides):
    data = {
        "language": "pt",
        "act": "knowledge_question",
        "has_greeting": False,
        "has_reaction": False,
        "sentiment": "neutral",
        "reaction_intensity": "none",
        "has_question": True,
        "needs_retrieval": True,
        "topic_continuity": False,
        "search_query": "Como funciona a capina elétrica?",
        "requested_language": "none",
        "answer_depth": "standard",
        "core_goal": "explicar a capina elétrica",
        "followup_mode": "none",
        "offered_topics": [],
        "warmth": "neutral",
        "terminology_level": "plain",
    }
    data.update(overrides)
    return data


def _decision(**overrides):
    data = {
        "language": "pt",
        "act": "knowledge_question",
        "has_greeting": False,
        "has_reaction": False,
        "sentiment": "neutral",
        "reaction_intensity": "none",
        "has_question": True,
        "needs_retrieval": True,
        "topic_continuity": False,
        "search_query": "Como funciona a capina elétrica?",
        "requested_language": None,
        "answer_depth": "standard",
        "core_goal": "explicar a capina elétrica",
        "followup_mode": "none",
        "offered_topics": (),
        "warmth": "neutral",
        "terminology_level": "plain",
    }
    data.update(overrides)
    return router.RoutingDecision(**data)


def _generation_result(
    text: str,
    *,
    job_id: str = "job-test",
    finish_reason: str = "stop",
) -> ai_worker.GenerationResult:
    return ai_worker.GenerationResult(
        text=text,
        job_id=job_id,
        finish_reason=finish_reason,
        input_tokens=100,
        output_tokens=40,
        model="test-model",
    )


class RouterClassificationTests(unittest.TestCase):
    def test_portuguese_greeting_mirrors_time_of_day(self):
        decision = _decision(
            act="social_only",
            has_greeting=True,
            has_question=False,
            needs_retrieval=False,
            search_query="",
        )
        self.assertEqual(
            router.reply_without_retrieval(decision, "Olá, boa tarde!"),
            "Oi, boa tarde! Tudo bem? 😊",
        )
        self.assertEqual(
            router.reply_without_retrieval(
                decision,
                "Oi, boa tarde, tudo bem?",
            ),
            "Oi, boa tarde! Tudo ótimo, e você? 😊",
        )

    def test_wellbeing_acknowledgment_does_not_ask_how_user_is_again(self):
        decision = _decision(
            act="social_only",
            has_greeting=True,
            has_question=False,
            needs_retrieval=False,
            search_query="",
        )
        self.assertEqual(
            router.reply_without_retrieval(decision, "Tudo bem, obrigado!"),
            "Que bom! Como posso ajudar? 😊",
        )

    def test_broad_ad_request_gets_canonical_query_and_guided_topics(self):
        raw = _raw_classification(
            search_query="informações da Zasso",
            followup_mode="none",
            offered_topics=[],
        )
        with patch("bot.router.ai_worker.classify_message", return_value=raw):
            decision = router.classify_message(
                "Tudo bem, obrigado! Vi um anúncio e gostaria de mais informações.",
                [],
                SimpleNamespace(),
            )

        self.assertIn("capina elétrica", decision.search_query)
        self.assertEqual(decision.answer_depth, "standard")
        self.assertEqual(decision.followup_mode, "offer_topics")
        self.assertEqual(decision.offered_topics, router.default_guided_topics())

    def test_bare_acceptance_does_not_choose_between_previous_options(self):
        history = [
            {
                "role": "assistant",
                "content": (
                    "Quer entender como funciona ou prefere saber sobre segurança?"
                ),
            }
        ]
        self.assertTrue(router.ambiguous_acceptance("Adoraria!", history))
        self.assertFalse(
            router.ambiguous_acceptance(
                "Adoraria!",
                [
                    {
                        "role": "assistant",
                        "content": "Quer que eu explique a segurança da operação?",
                    }
                ],
            )
        )
        decision = _decision(
            act="positive_reaction",
            has_reaction=True,
            sentiment="positive",
            reaction_intensity="medium",
            has_question=False,
            needs_retrieval=False,
            search_query="",
        )
        self.assertEqual(
            router.reply_without_retrieval(decision, "Adoraria!", history),
            "Claro!",
        )
        self.assertIn(
            "funcionamento",
            router.render_followup(
                "clarify_choice",
                router.default_guided_topics(),
                "pt",
            ),
        )

    def test_metadata_is_authoritative_for_previous_offered_topics(self):
        history = [
            {
                "role": "assistant",
                "content": "Escolha o caminho que fizer mais sentido.",
                "response_meta": {
                    "offered_topics": ["safety", "comparison"],
                },
            }
        ]
        self.assertTrue(router.ambiguous_acceptance("Sim, por favor!", history))
        self.assertEqual(
            router.previous_offered_topics(history),
            ("safety", "comparison"),
        )

    def test_classifier_returns_normalized_response_plan(self):
        raw = _raw_classification(
            answer_depth="standard",
            core_goal="apresentar a tecnologia em linguagem comum",
            followup_mode="offer_topics",
            offered_topics=["functioning", "safety", "comparison"],
            warmth="warm",
            terminology_level="plain",
        )
        with patch("bot.router.ai_worker.classify_message", return_value=raw):
            decision = router.classify_message(
                "Quero conhecer a tecnologia da Zasso.",
                [],
                SimpleNamespace(),
            )

        self.assertEqual(decision.followup_mode, "offer_topics")
        self.assertEqual(
            decision.offered_topics,
            ("functioning", "safety", "comparison"),
        )
        self.assertIn("objetivo essencial", router.generation_guidance(decision))

    def test_request_for_clearer_explanation_overrides_positive_reaction_prefix(self):
        decision = _decision(
            act="contextual_followup",
            has_reaction=True,
            sentiment="positive",
            reaction_intensity="high",
        )
        self.assertEqual(
            router.composition_prefix(
                decision,
                "Aaaah, que legal! Mas não entendi muito bem ainda.",
            ),
            "Tranquilo, te explico melhor!",
        )

    def test_confirmation_question_gets_direct_answer_guidance(self):
        guidance = router.generation_guidance(
            _decision(),
            "Parece ser mais profunda que a tradicional, né?",
        )
        self.assertIn('"Sim — nesse sentido, ..."', guidance)
        self.assertIn("obrigatoriamente reordene", guidance)
        self.assertIn('Use "Não exatamente" somente', guidance)

    def test_partial_depth_confirmation_acknowledges_valid_meaning_first(self):
        answer = router.make_confirmation_direct(
            "Parece ser mais profunda que a tradicional, né?",
            (
                'A capina elétrica não necessariamente atua de forma "mais profunda" '
                "no sentido de penetrar o solo, mas atua de maneira diferente."
            ),
            "pt",
        )
        self.assertTrue(
            answer.startswith(
                "Sim — no sentido de atuar além da superfície da planta."
            )
        )
        self.assertIn("não necessariamente", answer)

    def test_company_confirmation_keeps_question_without_retrieval(self):
        raw = _raw_classification(
            act="company_confirmation",
            has_greeting=True,
            has_question=True,
            needs_retrieval=False,
            search_query="",
        )
        with patch("bot.router.ai_worker.classify_message", return_value=raw):
            decision = router.classify_message(
                "Olá, bom dia! Aqui eu falo com a Zasso?", [], SimpleNamespace()
            )

        self.assertEqual(decision.act, "company_confirmation")
        self.assertTrue(decision.has_greeting)
        self.assertFalse(decision.needs_retrieval)
        self.assertEqual(decision.search_query, "")

    def test_company_confirmation_mirrors_period_and_wellbeing(self):
        decision = _decision(
            act="company_confirmation",
            has_greeting=True,
            has_question=True,
            needs_retrieval=False,
            search_query="",
        )
        self.assertEqual(
            router.reply_without_retrieval(
                decision,
                "Olá, bom dia! Tudo bem? Esse é o SAC da Zasso?",
            ),
            "Oi, bom dia! Tudo ótimo, e você? Sim, você está falando com a Zasso.",
        )

    def test_specific_question_does_not_repeat_guided_topics(self):
        raw = _raw_classification(
            followup_mode="offer_topics",
            offered_topics=["comparison", "safety", "functioning"],
            core_goal="comparar os métodos e explicar o tempo de ação",
        )
        with patch("bot.router.ai_worker.classify_message", return_value=raw):
            decision = router.classify_message(
                "Quais são as vantagens e qual é o tempo de ação?",
                [],
                SimpleNamespace(),
            )

        self.assertEqual(decision.followup_mode, "none")
        self.assertEqual(decision.offered_topics, ())

    def test_reaction_with_question_becomes_retrieval_but_not_greeting(self):
        raw = _raw_classification(
            act="positive_reaction",
            has_greeting=True,
            has_reaction=True,
            sentiment="positive",
            reaction_intensity="high",
            topic_continuity=True,
            search_query="Funciona em qualquer erva?",
        )
        with patch("bot.router.ai_worker.classify_message", return_value=raw):
            decision = router.classify_message(
                "Uau, parece ótimo! Mas funciona em qualquer tipo de erva?",
                [],
                SimpleNamespace(),
            )

        self.assertEqual(decision.act, "contextual_followup")
        self.assertFalse(decision.has_greeting)
        self.assertTrue(decision.has_reaction)
        self.assertTrue(decision.needs_retrieval)

    def test_negative_reaction_has_contextual_non_rag_reply(self):
        decision = _decision(
            act="negative_reaction",
            has_reaction=True,
            sentiment="negative",
            reaction_intensity="high",
            has_question=False,
            needs_retrieval=False,
            search_query="",
        )
        answer = router.reply_without_retrieval(decision)
        self.assertIn("?", answer)
        self.assertTrue(
            any(
                fragment in answer.lower()
                for fragment in ("preocup", "ponto", "pegou", "pior")
            )
        )


class ReactionGenerationTests(unittest.TestCase):
    def test_main_generation_uses_prompt_instead_of_token_cap(self):
        settings = SimpleNamespace(ai_worker_priority=2)
        job = {
            "result": {
                "text": "Resposta completa.",
                "finish_reason": "stop",
                "input_tokens": 100,
                "output_tokens": 20,
                "model": "test-model",
            }
        }
        with patch("bot.ai_worker._submit_job", return_value="job-1") as submit, patch(
            "bot.ai_worker._poll",
            return_value=job,
        ):
            result = ai_worker.generate(
                "Sistema.",
                "Contexto.",
                "Pergunta.",
                "pt",
                settings,
                response_guidance="Seja breve.",
            )

        payload = submit.call_args.args[0]["payload"]
        self.assertNotIn("num_predict", payload["options"])
        self.assertEqual(payload["options"]["num_ctx"], 8192)
        self.assertEqual(result.finish_reason, "stop")

    def test_retry_inputs_shrink_context_and_history(self):
        chunks = list(range(8))
        history = [{"role": "user", "content": str(i)} for i in range(6)]

        self.assertEqual(handler._generation_inputs(0, chunks, history), (chunks, history))
        self.assertEqual(
            handler._generation_inputs(1, chunks, history),
            (chunks[:5], history[-2:]),
        )
        self.assertEqual(
            handler._generation_inputs(2, chunks, history),
            (chunks[:3], []),
        )

    def test_completion_guard_rejects_length_and_dangling_sentence(self):
        self.assertFalse(
            ai_worker.is_complete_generation(
                _generation_result(
                    "Sobre o tempo de ação, os resultados dependem",
                    finish_reason="length",
                )
            )
        )
        self.assertFalse(
            ai_worker.is_complete_generation(
                _generation_result(
                    "Sobre o tempo de ação, os resultados dependem.",
                    finish_reason="stop",
                )
            )
        )
        self.assertTrue(
            ai_worker.is_complete_generation(
                _generation_result(
                    "O tempo varia conforme a planta e as condições de aplicação."
                )
            )
        )

    def test_reaction_uses_temperature_point_three(self):
        settings = SimpleNamespace(
            ai_worker_base_url="http://worker",
            ai_worker_service_token="test",
            ai_worker_priority=2,
        )
        response = SimpleNamespace(
            raise_for_status=lambda: None,
            json=lambda: {"job_id": "job-1"},
        )
        with patch("bot.ai_worker.httpx.post", return_value=response) as post, patch(
            "bot.ai_worker._poll",
            return_value={"result": {"text": "Que legal, né?"}},
        ):
            answer = ai_worker.generate_reaction(
                "Nossa, que massa!",
                "positive_reaction",
                "positive",
                "high",
                "pt",
                [{"role": "assistant", "content": "Explicação anterior."}],
                settings,
            )

        payload = post.call_args.kwargs["json"]["payload"]
        self.assertEqual(payload["options"]["temperature"], 0.3)
        self.assertFalse(payload["think"])
        self.assertEqual(answer, "Que legal, né?")

    def test_job_submission_does_not_retry_ambiguous_server_error(self):
        settings = SimpleNamespace(
            ai_worker_base_url="http://worker",
            ai_worker_service_token="test",
        )
        failed = httpx.Response(
            500,
            request=httpx.Request("POST", "http://worker/v1/jobs"),
        )
        with patch(
            "bot.ai_worker.httpx.post",
            return_value=failed,
        ) as post, patch("bot.ai_worker.time.sleep"):
            with self.assertRaises(httpx.HTTPStatusError):
                ai_worker._submit_job({"operation": "generate"}, settings)

        self.assertEqual(post.call_count, 1)

    def test_job_submission_retries_connect_error_before_request(self):
        settings = SimpleNamespace(
            ai_worker_base_url="http://worker",
            ai_worker_service_token="test",
        )
        request = httpx.Request("POST", "http://worker/v1/jobs")
        success = SimpleNamespace(
            raise_for_status=lambda: None,
            json=lambda: {"job_id": "job-after-connect"},
        )
        with patch(
            "bot.ai_worker.httpx.post",
            side_effect=[httpx.ConnectError("offline", request=request), success],
        ) as post, patch("bot.ai_worker.time.sleep"):
            job_id = ai_worker._submit_job({"operation": "generate"}, settings)

        self.assertEqual(job_id, "job-after-connect")
        self.assertEqual(post.call_count, 2)


class ToneEnforcementTests(unittest.TestCase):
    def test_only_allowed_emojis_survive_and_message_is_capped_at_two(self):
        answer = tone.sanitize_reply(
            "Olá 😎 🌱⚡🚀✨😊! Vamos nessa 🚜"
        )
        self.assertEqual(answer, "Olá! 🌱⚡ Vamos nessa")
        self.assertEqual(
            sum(answer.count(emoji) for emoji in tone.ALLOWED_EMOJIS),
            2,
        )

    def test_sanitizer_preserves_regular_unicode_text(self):
        self.assertEqual(
            tone.sanitize_reply("Capina elétrica: ação física, sem química."),
            "Capina elétrica: ação física, sem química.",
        )

    def test_sanitizer_normalizes_recurring_portuguese_terms(self):
        self.assertEqual(
            tone.sanitize_reply(
                "A Electroherb controla vegetação indesejada e plantas-alvo."
            ),
            "O Electroherb controla ervas daninhas.",
        )

    def test_sanitizer_removes_repeated_electroherb_apposition(self):
        self.assertEqual(
            tone.sanitize_reply(
                "A tecnologia Electroherb, a tecnologia de capina elétrica da Zasso, "
                "evita herbicidas."
            ),
            "O Electroherb, a tecnologia de capina elétrica da Zasso, evita herbicidas.",
        )

    def test_sanitizer_places_sentence_punctuation_before_emoji(self):
        self.assertEqual(
            tone.sanitize_reply("Menor perturbação do solo 🌱."),
            "Menor perturbação do solo. 🌱",
        )

    def test_history_avoids_repeated_emoji_and_reintroduction(self):
        adapted = tone.adapt_reply_to_history(
            (
                "O Electroherb, a tecnologia de capina elétrica da Zasso, "
                "atua nos tecidos da planta. ⚡"
            ),
            [
                {
                    "role": "assistant",
                    "content": "O Electroherb usa energia controlada. ⚡",
                }
            ],
        )
        self.assertEqual(
            tone.sanitize_reply(adapted),
            "A capina elétrica da Zasso atua nos tecidos da planta.",
        )


class HandlerFlowTests(unittest.TestCase):
    def _base_patches(self, stack, decision):
        settings = SimpleNamespace()
        state = SimpleNamespace(
            chat_id=123,
            session_id=UUID("00000000-0000-0000-0000-000000000001"),
            language=None,
            language_locked=False,
            handoff_priority=0,
        )
        stack.enter_context(patch("bot.handler.router.is_human_handoff_request", return_value=False))
        stack.enter_context(patch("bot.handler.router.route_guardrail", return_value=None))
        stack.enter_context(patch("bot.handler.router.classify_message", return_value=decision))
        stack.enter_context(
            patch("bot.handler.memory.load_context", return_value=(state, []))
        )
        stack.enter_context(patch("bot.handler.memory.resolve_language", return_value="pt"))
        return settings

    def test_company_confirmation_never_searches_vectors(self):
        decision = _decision(
            act="company_confirmation",
            has_greeting=True,
            has_question=True,
            needs_retrieval=False,
            search_query="",
        )
        with ExitStack() as stack:
            settings = self._base_patches(stack, decision)
            search = stack.enter_context(patch("bot.handler.search_chunks"))
            record = stack.enter_context(patch("bot.handler.memory.record_non_rag_turn"))
            answer = handler.answer_question(123, "Olá! Aqui eu falo com a Zasso?", settings)

        search.assert_not_called()
        record.assert_called_once()
        self.assertIn("Zasso", answer)

    def test_greeting_plus_question_composes_prefix_and_clean_rag_query(self):
        decision = _decision(has_greeting=True)
        chunks = [
            RetrievedChunk(
                chunk_id=UUID("00000000-0000-0000-0000-000000000018"),
                content_hash="hash-18",
                faq_id="FAQ-018",
                question="How does electrical weeding work?",
                section="Short Answer",
                visibility="public",
                content="Electrical weeding transfers controlled energy through the plant.",
                distance=0.2,
            )
        ]
        with ExitStack() as stack:
            settings = self._base_patches(stack, decision)
            search = stack.enter_context(patch("bot.handler.search_chunks", return_value=chunks))
            stack.enter_context(patch("bot.handler.memory.merge_chunks", return_value=chunks))
            stack.enter_context(
                patch(
                    "bot.handler.ai_worker.generate",
                    return_value=_generation_result("A energia atravessa a planta."),
                )
            )
            stack.enter_context(
                patch("bot.handler.memory.should_offer_engagement_handoff", return_value=False)
            )
            record = stack.enter_context(patch("bot.handler.memory.record_turn"))
            answer = handler.answer_question(
                123, "Olá! Como funciona a capina elétrica?", settings
            )

        search.assert_called_once_with(
            "Como funciona a capina elétrica?", settings, limit=5
        )
        self.assertEqual(answer, "Oi! A energia atravessa a planta.")
        record.assert_called_once()

    def test_pure_positive_reaction_does_not_call_rag(self):
        decision = _decision(
            act="positive_reaction",
            has_reaction=True,
            sentiment="positive",
            reaction_intensity="high",
            has_question=False,
            needs_retrieval=False,
            search_query="",
        )
        with ExitStack() as stack:
            settings = self._base_patches(stack, decision)
            search = stack.enter_context(patch("bot.handler.search_chunks"))
            generate = stack.enter_context(patch("bot.handler.ai_worker.generate"))
            reaction = stack.enter_context(
                patch(
                    "bot.handler.ai_worker.generate_reaction",
                    return_value="Que legal — esse é justamente o tipo de reação que a proposta costuma despertar!",
                )
            )
            record = stack.enter_context(patch("bot.handler.memory.record_non_rag_turn"))
            answer = handler.answer_question(
                123, "Uau, parece ótimo e inovador!", settings
            )

        search.assert_not_called()
        generate.assert_not_called()
        reaction.assert_called_once()
        record.assert_called_once()
        self.assertEqual(
            answer,
            "Que legal — esse é justamente o tipo de reação que a proposta costuma despertar!",
        )

    def test_previous_chunks_only_merge_for_contextual_followup(self):
        decision = _decision(
            act="contextual_followup",
            topic_continuity=True,
            search_query="Quais são as medidas de segurança da capina elétrica?",
        )
        chunks = [
            RetrievedChunk(
                chunk_id=UUID("00000000-0000-0000-0000-000000000100"),
                content_hash="hash-100",
                faq_id="FAQ-100",
                question="Is it safe?",
                section="Short Answer",
                visibility="public",
                content="Use trained operators.",
                distance=0.2,
            )
        ]
        previous = [
            RetrievedChunk(
                chunk_id=UUID("00000000-0000-0000-0000-000000000018"),
                content_hash="hash-18",
                faq_id="FAQ-018",
                question="How does it work?",
                section="Short Answer",
                visibility="public",
                content="It transfers energy.",
                distance=0.2,
            )
        ]
        with ExitStack() as stack:
            settings = self._base_patches(stack, decision)
            stack.enter_context(patch("bot.handler.search_chunks", return_value=chunks))
            load_previous = stack.enter_context(
                patch("bot.handler.memory.load_last_assistant_chunks", return_value=previous)
            )
            stack.enter_context(patch("bot.handler.memory.merge_chunks", return_value=chunks))
            stack.enter_context(
                patch(
                    "bot.handler.ai_worker.generate",
                    return_value=_generation_result("Resposta."),
                )
            )
            stack.enter_context(
                patch("bot.handler.memory.should_offer_engagement_handoff", return_value=False)
            )
            stack.enter_context(patch("bot.handler.memory.record_turn"))
            handler.answer_question(123, "E quanto à segurança?", settings)

        load_previous.assert_called_once()

    def test_rag_core_and_followup_are_rendered_and_metadata_is_recorded(self):
        decision = _decision(
            followup_mode="offer_topics",
            offered_topics=("functioning", "safety", "comparison"),
            core_goal="apresentar a tecnologia",
        )
        chunks = [
            RetrievedChunk(
                chunk_id=UUID("00000000-0000-0000-0000-000000000200"),
                content_hash="hash-200",
                faq_id="FAQ-001",
                question="What is Zasso?",
                section="Short Answer",
                visibility="public",
                content="Zasso develops electrical weeding technology.",
                distance=0.2,
            )
        ]
        with ExitStack() as stack:
            settings = self._base_patches(stack, decision)
            stack.enter_context(patch("bot.handler.search_chunks", return_value=chunks))
            stack.enter_context(patch("bot.handler.memory.merge_chunks", return_value=chunks))
            generate = stack.enter_context(
                patch(
                    "bot.handler.ai_worker.generate",
                    return_value=_generation_result(
                        "A Zasso desenvolve tecnologia de capina elétrica."
                    ),
                )
            )
            stack.enter_context(
                patch("bot.handler.memory.should_offer_engagement_handoff", return_value=False)
            )
            record = stack.enter_context(patch("bot.handler.memory.record_turn"))
            answer = handler.answer_question(
                123,
                "Quero conhecer a tecnologia da Zasso.",
                settings,
            )

        self.assertIn("Quer entender primeiro", answer)
        self.assertIn("resposta essencial", generate.call_args.kwargs["response_guidance"])
        metadata = record.call_args.kwargs["response_meta"]
        self.assertEqual(
            metadata["offered_topics"],
            ["functioning", "safety", "comparison"],
        )

    def test_engagement_handoff_is_a_separate_non_blocking_message(self):
        decision = _decision()
        chunks = [
            RetrievedChunk(
                chunk_id=UUID("00000000-0000-0000-0000-000000000250"),
                content_hash="hash-250",
                faq_id="FAQ-250",
                question="How deep does it act?",
                section="Short Answer",
                visibility="public",
                content="The effect depends on field conditions.",
                distance=0.2,
            )
        ]
        note = (
            "Aproveitando: deixei seus pontos organizados para nossa equipe. "
            "Podemos seguir conversando por aqui normalmente 😊"
        )
        with ExitStack() as stack:
            settings = self._base_patches(stack, decision)
            stack.enter_context(patch("bot.handler.search_chunks", return_value=chunks))
            stack.enter_context(patch("bot.handler.memory.merge_chunks", return_value=chunks))
            stack.enter_context(
                patch(
                    "bot.handler.ai_worker.generate",
                    return_value=_generation_result("A resposta técnica continua aqui."),
                )
            )
            stack.enter_context(
                patch("bot.handler.memory.should_offer_engagement_handoff", return_value=True)
            )
            stack.enter_context(
                patch("bot.handler.router.pick_engagement_note", return_value=note)
            )
            mark_handoff = stack.enter_context(patch("bot.handler.memory.mark_handoff"))
            record = stack.enter_context(patch("bot.handler.memory.record_turn"))

            messages = handler.answer_messages(
                123,
                "Isso chega mais fundo?",
                settings,
            )

        self.assertEqual(messages, ["A resposta técnica continua aqui.", note])
        self.assertNotIn("equipe", messages[0])
        self.assertIn("seguir conversando", messages[1])
        mark_handoff.assert_called_once_with(
            123,
            priority=1,
            reason="engagement_threshold",
            settings=settings,
        )
        self.assertEqual(
            record.call_args.kwargs["assistant_followups"],
            [
                (
                    note,
                    {
                        "act": "engagement_handoff_notice",
                        "handoff_priority": 1,
                    },
                )
            ],
        )

    def test_incomplete_generation_is_repaired_once_before_persisting(self):
        decision = _decision()
        chunks = [
            RetrievedChunk(
                chunk_id=UUID("00000000-0000-0000-0000-000000000300"),
                content_hash="hash-300",
                faq_id="FAQ-060",
                question="How effective is it?",
                section="Detailed Answer",
                visibility="public",
                content="Results depend on plant and field conditions.",
                distance=0.2,
            )
        ]
        with ExitStack() as stack:
            settings = self._base_patches(stack, decision)
            stack.enter_context(patch("bot.handler.search_chunks", return_value=chunks))
            stack.enter_context(patch("bot.handler.memory.merge_chunks", return_value=chunks))
            generate = stack.enter_context(
                patch(
                    "bot.handler.ai_worker.generate",
                    side_effect=[
                        _generation_result(
                            "Os resultados dependem",
                            job_id="job-length",
                            finish_reason="length",
                        ),
                        _generation_result(
                            "Os resultados variam conforme a planta e as condições de aplicação.",
                            job_id="job-repair",
                        ),
                    ],
                )
            )
            stack.enter_context(
                patch("bot.handler.memory.should_offer_engagement_handoff", return_value=False)
            )
            handoff = stack.enter_context(patch("bot.handler.memory.mark_handoff"))
            record = stack.enter_context(patch("bot.handler.memory.record_turn"))

            answer = handler.answer_question(123, "Qual é o tempo de ação?", settings)

        self.assertEqual(
            answer,
            "Os resultados variam conforme a planta e as condições de aplicação.",
        )
        self.assertEqual(generate.call_count, 2)
        self.assertEqual(generate.call_args.kwargs["repair_attempt"], 1)
        handoff.assert_not_called()
        record.assert_called_once()
        metadata = record.call_args.kwargs["response_meta"]["generation"]
        self.assertEqual(metadata["attempt_count"], 2)
        self.assertTrue(metadata["repaired"])

    def test_third_unsuccessful_generation_routes_to_human(self):
        decision = _decision()
        chunks = [
            RetrievedChunk(
                chunk_id=UUID("00000000-0000-0000-0000-000000000301"),
                content_hash="hash-301",
                faq_id="FAQ-060",
                question="How effective is it?",
                section="Detailed Answer",
                visibility="public",
                content="Results depend on plant and field conditions.",
                distance=0.2,
            )
        ]
        incomplete = [
            _generation_result("Resposta", job_id=f"job-{index}", finish_reason="length")
            for index in range(1, 4)
        ]
        with ExitStack() as stack:
            settings = self._base_patches(stack, decision)
            stack.enter_context(patch("bot.handler.search_chunks", return_value=chunks))
            stack.enter_context(patch("bot.handler.memory.merge_chunks", return_value=chunks))
            generate = stack.enter_context(
                patch("bot.handler.ai_worker.generate", side_effect=incomplete)
            )
            handoff = stack.enter_context(patch("bot.handler.memory.mark_handoff"))
            record_non_rag = stack.enter_context(
                patch("bot.handler.memory.record_non_rag_turn")
            )
            record_rag = stack.enter_context(patch("bot.handler.memory.record_turn"))

            answer = handler.answer_question(123, "Qual é o tempo de ação?", settings)

        self.assertEqual(generate.call_count, 3)
        self.assertIn("nossa equipe", answer)
        handoff.assert_called_once_with(
            123,
            priority=2,
            reason="generation_failed_after_two_retries",
            settings=settings,
        )
        record_rag.assert_not_called()
        record_non_rag.assert_called_once()
        self.assertEqual(
            record_non_rag.call_args.kwargs["response_meta"]["generation"]["attempt_count"],
            3,
        )


if __name__ == "__main__":
    unittest.main()
