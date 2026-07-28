"""
Detecção do idioma da pergunta — necessário porque o sacf-ai-worker só força
o idioma da resposta se receber `payload.language` explicitamente (ver
`_apply_language` em app/core/validation.py do worker). Sem isso, o modelo
decide sozinho, e demonstrou (teste real, ver ai_test_20_results.md) que
ignora perguntas em inglês/holandês e responde em português de qualquer
jeito — provavelmente porque o system_prompt e o contexto RAG são/estão
majoritariamente em português/inglês.

Classificação primária via LLM (bot/ai_worker.classify_language): agora que o
worker roda gemma4:26b com think:false real (~150ms, sem custo de raciocínio)
e suporta `format` com enum, a classificação é mais confiável que heurística
estatística — resolve o caso documentado de PT/ES confundidos com 99,7% de
confiança pelo langid em frase curta (ver histórico abaixo).

Fallback: se a chamada ao worker falhar (rede, timeout, erro do provider) ou
devolver algo fora da lista esperada, cai no langid — mais fraco, mas local e
instantâneo, não bloqueia a resposta ao usuário por causa de uma classificação
auxiliar.
"""
import logging

from langid.langid import LanguageIdentifier, model

from bot import ai_worker
from bot.config import Settings

logger = logging.getLogger(__name__)

# Mesma lista de bot/ai_worker.py — ver comentário lá sobre a separação.
_CANDIDATE_LANGUAGES = [
    "pt", "en", "es", "de", "fr", "it", "nl", "ja", "ar", "zh",
    "ru", "pl", "sv", "no", "da", "fi",
]
_DEFAULT_LANGUAGE = "pt"
_CONFIDENCE_THRESHOLD = 0.5

_identifier = LanguageIdentifier.from_modelstring(model, norm_probs=True)
_identifier.set_languages(_CANDIDATE_LANGUAGES)


def _detect_language_fallback(text: str) -> str:
    """Heurística local (langid) — usada só quando a classificação via LLM falha
    ou devolve algo não confiável. LIMITAÇÃO CONHECIDA: português e espanhol têm
    vocabulário curto muito parecido; o langid já errou "Como funciona a capina
    elétrica?" como espanhol com 99,7% de confiança. É exatamente o caso que a
    classificação via LLM resolve — este caminho é só a rede de segurança."""
    code, confidence = _identifier.classify(text)
    if confidence < _CONFIDENCE_THRESHOLD:
        return _DEFAULT_LANGUAGE
    return code


def detect_language(text: str, settings: Settings) -> str:
    """Devolve o código de idioma (ISO 639-1, ex: 'en', 'pt', 'de') da pergunta.
    Tenta classificar via LLM primeiro; cai no langid local se isso falhar."""
    try:
        code = ai_worker.classify_language(text, settings)
    except ai_worker.AIWorkerError as exc:
        logger.warning("Classificacao de idioma via LLM falhou (%s) - usando fallback langid.", exc)
        return _detect_language_fallback(text)

    if code not in _CANDIDATE_LANGUAGES:
        # Cobre tanto "other" (o modelo genuinamente não identificou) quanto
        # qualquer resposta inesperada — mesmo com o schema, vale não confiar
        # cegamente em texto vindo de rede.
        logger.info("Classificacao via LLM devolveu %r - usando fallback langid.", code)
        return _detect_language_fallback(text)
    return code
