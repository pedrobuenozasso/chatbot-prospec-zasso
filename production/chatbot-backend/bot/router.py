"""
Roteamento leve ANTES da busca vetorial — atalho de UX pros casos óbvios
(saudação, xingamento, tentativa de extrair dado interno), não a barreira de
segurança real. A barreira de verdade continua sendo o system_prompt + a
ausência de segredo na base (validado empiricamente, ver debt.md). Isso aqui
só evita gastar embedding/busca/LLM e devolve resposta na hora nos casos
óbvios; qualquer coisa fora desses padrões cai no fluxo normal de RAG.

Baseado em palavra-chave (PT/EN) — frágil por natureza (falso positivo/
negativo em outros idiomas ou frases fora do padrão), suficiente pro MVP.

Respostas: pool de ~10 variantes por categoria, sorteada a cada resposta pra não
soar repetitivo. As variantes foram GERADAS por IA uma única vez (em tempo de
desenvolvimento, com gemma4:26b) e revisadas à mão — não há chamada de IA em
runtime aqui, o pool é fixo no código. A estrutura é multilíngue por design
(_REPLY_POOLS[idioma]), mas no estágio 1 só PT-BR está populado e sempre usado;
quando outros idiomas forem adicionados, `route()` já aceita o parâmetro.
"""
import random
import re
import unicodedata
from dataclasses import dataclass

from bot import ai_worker
from bot.config import Settings

# Saudação/smalltalk sem conteúdo específico da Zasso — checado por CLÁUSULA
# (a mensagem inteira precisa ser só isso), não por regex ancorado numa frase
# única: "Oi, bom dia! Tudo bem?" é 3 cláusulas, cada uma reconhecida, então
# a mensagem inteira é smalltalk. Isso evita o bug de só pegar "Oi" sozinho
# e mandar "Oi, bom dia! Tudo bem?" pro RAG (onde não há chunk correspondente
# e a pergunta cai no fallback de "sem informação" por engano).
_GREETING_PHRASES = {
    "oi", "oie", "opa", "eae", "eai", "e ai", "ola", "olá",
    "bom dia", "boa tarde", "boa noite",
    "hi", "hii", "hello", "hey", "hiya", "yo",
    "good morning", "good afternoon", "good evening",
    "tudo bem", "tudo bom", "como vai", "como você está", "como voce esta",
    "pode me ajudar", "preciso de ajuda", "você pode ajudar", "voce pode ajudar",
    "can you help me", "can you help", "i need help",
}

_CLAUSE_SPLIT = re.compile(r"[,;!?.]+")


def _is_greeting_or_smalltalk(text: str) -> bool:
    clauses = [c.strip().lower() for c in _CLAUSE_SPLIT.split(text)]
    clauses = [c for c in clauses if c]
    return bool(clauses) and all(c in _GREETING_PHRASES for c in clauses)


def reply_to_social(text: str, language: str = "pt") -> str:
    """Espelha a saudação em PT-BR em vez de responder com uma abertura aleatória."""
    if language != "pt":
        return _pick("greeting", language)

    lowered = text.casefold()
    acknowledges_wellbeing = (
        any(fragment in lowered for fragment in ("tudo bem", "tudo bom"))
        and any(fragment in lowered for fragment in ("obrigado", "obrigada", "valeu"))
    )
    if acknowledges_wellbeing:
        return "Que bom! Como posso ajudar? 😊"

    period = next(
        (
            greeting
            for greeting in ("bom dia", "boa tarde", "boa noite")
            if greeting in lowered
        ),
        None,
    )
    asks_wellbeing = any(
        phrase in lowered
        for phrase in ("tudo bem", "tudo bom", "como vai", "como você está", "como voce esta")
    )

    if period and asks_wellbeing:
        return f"Oi, {period}! Tudo ótimo, e você? 😊"
    if period:
        return f"Oi, {period}! Tudo bem? 😊"
    if asks_wellbeing:
        return "Oi! Tudo ótimo, e você? 😊"
    return "Oi! Tudo bem? 😊"


def _social_prefix(text: str, language: str = "pt") -> str:
    """Parte social de uma mensagem que também contém uma pergunta substantiva."""
    if language != "pt":
        return "Hi!"

    lowered = text.casefold()
    acknowledges_wellbeing = (
        any(fragment in lowered for fragment in ("tudo bem", "tudo bom"))
        and any(fragment in lowered for fragment in ("obrigado", "obrigada", "valeu"))
    )
    if acknowledges_wellbeing:
        return "Que bom!"

    period = next(
        (
            greeting
            for greeting in ("bom dia", "boa tarde", "boa noite")
            if greeting in lowered
        ),
        None,
    )
    asks_wellbeing = any(
        phrase in lowered
        for phrase in (
            "tudo bem",
            "tudo bom",
            "como vai",
            "como você está",
            "como voce esta",
        )
    )

    if period and asks_wellbeing:
        return f"Oi, {period}! Tudo ótimo, e você?"
    if period:
        return f"Oi, {period}!"
    if asks_wellbeing:
        return "Tudo ótimo, e você?"
    return "Oi!"


def _contains_greeting(text: str) -> bool:
    """Saudação tem vocabulário fechado; aqui a regra local é mais confiável."""
    clauses = [c.strip().lower() for c in _CLAUSE_SPLIT.split(text)]
    return any(c in _GREETING_PHRASES for c in clauses if c)


# Reação/confirmação de entendimento SEM pergunta nova (ex.: "Entendi. Parece
# ótimo né?") — bug real observado: sem essa categoria, isso caía no RAG, o
# estágio A concatenava com a última pergunta real, a busca trazia quase os
# mesmos chunks de antes, e o modelo gerava uma explicação quase-duplicada da
# anterior. Mesma técnica de clausula do greeting (mensagem inteira precisa
# ser só isso — "Entendi, mas existe vantagem?" tem cláusula fora da lista,
# então cai no RAG normal, como deve ser).
_ACKNOWLEDGMENT_PHRASES = {
    "entendi", "entendido", "saquei", "compreendi", "certo", "faz sentido",
    "legal", "bacana", "maneiro", "interessante", "que interessante",
    "nossa", "uau", "obrigado", "obrigada", "valeu", "show", "top",
    "parece otimo", "parece ótimo", "parece bom", "muito bom",
    "otimo", "ótimo", "perfeito", "beleza", "ok", "okay", "blz",
    "got it", "makes sense", "i see", "cool", "nice", "great", "thanks",
    "thank you", "perfect", "understood",
}


# "né"/"ne" solto no fim da cláusula é só uma partícula de confirmação
# (PT-BR coloquial) — "parece ótimo né" precisa bater com "parece ótimo".
_TRAILING_TAG = re.compile(r"\s+n[eé]$")


def _is_pure_acknowledgment(text: str) -> bool:
    clauses = [c.strip().lower() for c in _CLAUSE_SPLIT.split(text)]
    clauses = [_TRAILING_TAG.sub("", c) for c in clauses if c]
    return bool(clauses) and all(c in _ACKNOWLEDGMENT_PHRASES for c in clauses)


_BARE_ACCEPTANCES = {
    "sim",
    "sim por favor",
    "claro",
    "claro por favor",
    "com certeza",
    "quero",
    "adoraria",
    "adoraria sim",
    "gostaria",
    "por favor",
    "pode ser",
    "pode explicar",
    "vamos",
    "bora",
}
_GENERIC_OFFERS = (
    "mais algum detalhe",
    "saber mais",
    "ver mais",
    "continuar",
    "por onde",
)
_TOPIC_IDS = {
    "functioning",
    "safety",
    "comparison",
    "applications",
    "environmental_impact",
    "equipment",
}
_DEFAULT_GUIDED_TOPICS = ("functioning", "safety", "comparison")
_BROAD_INTRO_PHRASES = (
    "quem e a zasso",
    "quem voces sao",
    "conhecer a zasso",
    "saber mais sobre a zasso",
    "conhecer a tecnologia",
    "saber mais sobre a tecnologia",
    "o que a zasso faz",
    "o que voces fazem",
    "vi um anuncio",
    "mais infos",
    "mais informacoes",
    "gostaria de informacoes",
    "quero informacoes",
)
_TOPIC_LABELS = {
    "pt": {
        "functioning": "o funcionamento na prática",
        "safety": "a segurança da operação",
        "comparison": "as diferenças para métodos tradicionais",
        "applications": "onde a tecnologia pode ser usada",
        "environmental_impact": "os benefícios e cuidados ambientais",
        "equipment": "os equipamentos disponíveis",
    },
    "en": {
        "functioning": "how it works in practice",
        "safety": "operational safety",
        "comparison": "differences from traditional methods",
        "applications": "where the technology can be used",
        "environmental_impact": "its environmental benefits and considerations",
        "equipment": "the available equipment",
    },
}


def _plain_text(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    without_accents = "".join(
        char for char in decomposed if not unicodedata.combining(char)
    )
    return re.sub(r"[^a-z0-9 ]+", "", without_accents).strip()


def ambiguous_acceptance(
    text: str,
    history: list[dict[str, object]],
) -> bool:
    """Impede a LLM de escolher pelo cliente quando a oferta tinha várias opções."""
    if _plain_text(text) not in _BARE_ACCEPTANCES:
        return False
    previous = next(
        (message for message in reversed(history) if message.get("role") == "assistant"),
        None,
    )
    if previous:
        metadata = previous.get("response_meta") or {}
        offered_topics = metadata.get("offered_topics") or []
        if len(offered_topics) > 1:
            return True
    previous_assistant = (previous or {}).get("content", "").casefold()
    if not previous_assistant:
        return False
    has_multiple_options = " ou " in previous_assistant
    was_generic = any(phrase in previous_assistant for phrase in _GENERIC_OFFERS)
    return has_multiple_options or was_generic


def guided_acceptance_reply(language: str = "pt") -> str:
    return render_followup(
        "clarify_choice",
        _DEFAULT_GUIDED_TOPICS,
        language,
    )


def previous_offered_topics(
    history: list[dict[str, object]],
) -> tuple[str, ...]:
    previous = next(
        (message for message in reversed(history) if message.get("role") == "assistant"),
        None,
    )
    metadata = (previous or {}).get("response_meta") or {}
    topics = metadata.get("offered_topics") or []
    return tuple(topic for topic in topics if topic in _TOPIC_IDS)[:3]


def default_guided_topics() -> tuple[str, ...]:
    return _DEFAULT_GUIDED_TOPICS


def _is_broad_introduction(text: str) -> bool:
    plain = _plain_text(text)
    return any(phrase in plain for phrase in _BROAD_INTRO_PHRASES)


_EXTRACTION_PATTERN = re.compile(
    r"(system\s*prompt|prompt\s*(do\s*)?sistema|suas?\s*instru[çc][õo]es|"
    r"ignore?\s*(as\s*)?instru[çc][õo]es|ignore\s*(the\s*|your\s*)?instructions|"
    r"\.env\b|api\s*key|chave\s*de\s*api|credencia(l|is)|senha\b|password\b|token\s*de\s*acesso)",
    re.IGNORECASE,
)

# Lista curta e deliberadamente conservadora — o objetivo é pegar o caso óbvio
# sem gerar falso positivo em pergunta legítima. Não é filtro de moderação completo.
_PROFANITY_PATTERN = re.compile(
    r"\b(porra|caralho|merda|fdp|desgra[çc]ad[oa]|idiota|imbecil|"
    r"fuck|shit|asshole|bastard|bitch)\b",
    re.IGNORECASE,
)

# Pedido EXPLÍCITO de falar com humano/atendente — prioridade máxima de handoff
# (ver bot/memory.mark_handoff). Bug real observado: sem isso, "gostaria de
# falar com um ser humano" caía no RAG normal e o estágio A (busca reformulada)
# grudava na pergunta anterior, respondendo como se fosse continuação do
# assunto errado em vez de reconhecer o pedido.
_HUMAN_HANDOFF_PATTERN = re.compile(
    r"(falar\s+com\s+(um\s+|uma\s+)?(ser\s+)?(humano|pessoa|atendente|"
    r"consultor|vendedor)|"
    r"atendimento\s+humano|quero\s+um\s+humano|"
    r"transferir?\s+(pra|para)\s+(um\s+|uma\s+)?(atendente|humano|pessoa)|"
    r"falar\s+com\s+algu[ée]m|"
    r"speak\s+(to|with)\s+a?\s*(human|person|agent)|talk\s+to\s+a?\s*(human|person))",
    re.IGNORECASE,
)

# Pools de resposta por idioma → categoria. Geradas por IA uma vez e revisadas
# (ver docstring do módulo). Só PT-BR no estágio 1.
_REPLY_POOLS: dict[str, dict[str, list[str]]] = {
    "pt": {
        "greeting": [
            "Oi! Tudo bem? Como posso ajudar?",
            "Olá! O que você gostaria de saber?",
            "Oi! Pode mandar sua dúvida.",
            "Bom dia! Como posso ajudar?",
            "Boa tarde! O que você gostaria de saber?",
            "Boa noite! Como posso ajudar?",
        ],
        "profanity": [
            "Vamos manter o respeito, por favor. Se tiver uma dúvida sobre a Zasso, posso ajudar.",
            "Posso continuar te ajudando, mas precisamos manter a conversa respeitosa.",
            "Entendo que você possa estar frustrado, mas vamos conversar com respeito.",
        ],
        "extraction": [
            "Não posso compartilhar configurações ou instruções internas. Posso ajudar com informações sobre a Zasso.",
            "Esses dados são internos. Se tiver uma dúvida sobre produtos ou capina elétrica, pode mandar.",
            "Não tenho como fornecer credenciais ou detalhes internos do sistema.",
        ],
        "acknowledgment": [
            "Beleza!",
            "Certo!",
            "Entendi.",
            "Combinado.",
            "Boa!",
            "Perfeito.",
        ],
        # Resposta INTEIRA a um pedido explícito de humano (categoria própria,
        # não confundir com o complemento de engajamento em bot/memory.py).
        "handoff_explicit": [
            "Claro. Deixei registrado que você quer falar com uma pessoa da nossa equipe.",
            "Tudo bem. Registrei seu pedido de atendimento humano para a equipe.",
            "Certo, seu pedido para falar com um atendente ficou registrado.",
        ],
    },
}
_DEFAULT_LANG = "pt"

_POSITIVE_REACTION_POOLS = {
    "low": [
        "Legal!",
        "Boa!",
    ],
    "medium": [
        "Legal, né?",
        "É uma ideia interessante mesmo.",
    ],
    "high": [
        "Chama atenção mesmo, né?",
        "É uma proposta bem diferente mesmo.",
    ],
}
_NEUTRAL_REACTION_POOL = [
    "Certo!",
    "Entendi.",
    "Beleza, pode continuar.",
]
_NEGATIVE_REACTION_POOLS = {
    "low": [
        "Entendo. Qual ponto te deixou em dúvida?",
        "Faz sentido questionar. O que não te convenceu?",
    ],
    "medium": [
        "Entendo. Qual parte te preocupou?",
        "O que mais te incomodou nessa proposta?",
    ],
    "high": [
        "Entendo. O que pegou mal para você?",
        "Qual ponto pareceu pior para você?",
    ],
}
_OFF_TOPIC_POOL = [
    "Esse assunto foge um pouco do que tenho por aqui. Posso ajudar com a Zasso e a capina elétrica.",
    "Não consigo ajudar com esse tema, mas posso responder sobre a Zasso e a tecnologia Electroherb.",
]


@dataclass(frozen=True)
class RoutingDecision:
    language: str
    act: str
    has_greeting: bool
    has_reaction: bool
    sentiment: str
    reaction_intensity: str
    has_question: bool
    needs_retrieval: bool
    topic_continuity: bool
    search_query: str
    requested_language: str | None
    answer_depth: str
    core_goal: str
    followup_mode: str
    offered_topics: tuple[str, ...]
    warmth: str
    terminology_level: str


_RETRIEVAL_ACTS = {"knowledge_question", "contextual_followup"}
_KNOWN_ACTS = {
    "social_only",
    "company_confirmation",
    *_RETRIEVAL_ACTS,
    "positive_reaction",
    "neutral_acknowledgment",
    "negative_reaction",
    "handoff_request",
    "off_topic",
    "unsafe_or_extraction",
}


def classify_message(
    text: str,
    history: list[dict[str, object]],
    settings: Settings,
) -> RoutingDecision:
    """Usa a LLM somente para entender a mensagem; o código mantém o controle do fluxo."""
    raw = ai_worker.classify_message(text, history, settings)
    act = raw.get("act")
    if act not in _KNOWN_ACTS:
        raise ai_worker.AIWorkerError(f"ato conversacional inválido: {act!r}")

    has_question = bool(raw.get("has_question"))
    compound_capable_acts = {
        "social_only",
        "positive_reaction",
        "neutral_acknowledgment",
        "negative_reaction",
        "off_topic",
    }
    if has_question and act in compound_capable_acts:
        act = "contextual_followup" if raw.get("topic_continuity") else "knowledge_question"

    needs_retrieval = act in _RETRIEVAL_ACTS
    search_query = str(raw.get("search_query") or "").strip()
    if needs_retrieval and not search_query:
        search_query = text.strip()
    if not needs_retrieval:
        search_query = ""

    language = str(raw.get("language") or _DEFAULT_LANG)
    if language == "other":
        language = _DEFAULT_LANG
    sentiment = str(raw.get("sentiment") or "neutral")
    if sentiment not in {"positive", "neutral", "negative"}:
        sentiment = "neutral"
    intensity = str(raw.get("reaction_intensity") or "none")
    if intensity not in {"none", "low", "medium", "high"}:
        intensity = "none"
    requested_language = str(raw.get("requested_language") or "none")
    if requested_language == "none":
        requested_language = None
    answer_depth = str(raw.get("answer_depth") or "standard")
    if answer_depth not in {"micro", "brief", "standard", "detailed"}:
        answer_depth = "standard"
    core_goal = str(raw.get("core_goal") or "").strip() or search_query or text.strip()
    followup_mode = str(raw.get("followup_mode") or "none")
    if followup_mode not in {"none", "offer_topics", "clarify_choice"}:
        followup_mode = "none"
    offered_topics = tuple(
        dict.fromkeys(
            topic
            for topic in raw.get("offered_topics", [])
            if topic in _TOPIC_IDS
        )
    )[:3]
    if followup_mode == "none":
        offered_topics = ()
    elif len(offered_topics) < 2:
        offered_topics = _DEFAULT_GUIDED_TOPICS
    warmth = str(raw.get("warmth") or "neutral")
    if warmth not in {"neutral", "warm"}:
        warmth = "neutral"
    terminology_level = str(raw.get("terminology_level") or "plain")
    if terminology_level not in {"plain", "technical"}:
        terminology_level = "plain"
    broad_introduction = needs_retrieval and _is_broad_introduction(text)
    if broad_introduction:
        search_query = (
            "O que é a Zasso, o que ela oferece e como funciona sua tecnologia "
            "de capina elétrica?"
            if language == "pt"
            else (
                "What is Zasso, what does it offer, and how does its electric "
                "weed-control technology work?"
            )
        )
        answer_depth = "standard"
        followup_mode = "offer_topics"
        offered_topics = _DEFAULT_GUIDED_TOPICS
    if act in {
        "social_only",
        "company_confirmation",
        "neutral_acknowledgment",
        "negative_reaction",
        "handoff_request",
        "off_topic",
        "unsafe_or_extraction",
    }:
        followup_mode = "none"
        offered_topics = ()
    elif (
        needs_retrieval
        and followup_mode == "offer_topics"
        and not broad_introduction
    ):
        # Menus guiados ajudam numa apresentação ampla. Depois de uma pergunta
        # concreta, repetir os tópicos — especialmente o que acabou de ser
        # respondido — soa mecânico e quebra a continuidade.
        followup_mode = "none"
        offered_topics = ()
    if act in {"social_only", "company_confirmation"}:
        answer_depth = "micro"
    elif needs_retrieval and answer_depth == "micro":
        answer_depth = "brief"

    return RoutingDecision(
        language=language,
        act=act,
        has_greeting=_contains_greeting(text),
        has_reaction=bool(raw.get("has_reaction")),
        sentiment=sentiment,
        reaction_intensity=intensity,
        has_question=has_question,
        needs_retrieval=needs_retrieval,
        topic_continuity=bool(raw.get("topic_continuity")),
        search_query=search_query,
        requested_language=requested_language,
        answer_depth=answer_depth,
        core_goal=core_goal,
        followup_mode=followup_mode,
        offered_topics=offered_topics,
        warmth=warmth,
        terminology_level=terminology_level,
    )


def fallback_decision(text: str, language: str = _DEFAULT_LANG) -> RoutingDecision:
    """Caminho conservador quando o classificador remoto falha: preserva a pergunta."""
    return RoutingDecision(
        language=language,
        act="knowledge_question",
        has_greeting=False,
        has_reaction=False,
        sentiment="neutral",
        reaction_intensity="none",
        has_question=True,
        needs_retrieval=True,
        topic_continuity=False,
        search_query=text.strip(),
        requested_language=None,
        answer_depth="standard",
        core_goal=text.strip(),
        followup_mode="none",
        offered_topics=(),
        warmth="neutral",
        terminology_level="plain",
    )


def response_metadata(decision: RoutingDecision) -> dict[str, object]:
    return {
        "act": decision.act,
        "answer_depth": decision.answer_depth,
        "core_goal": decision.core_goal,
        "followup_mode": decision.followup_mode,
        "offered_topics": list(decision.offered_topics),
        "warmth": decision.warmth,
        "terminology_level": decision.terminology_level,
    }


def generation_guidance(
    decision: RoutingDecision,
    original_text: str = "",
) -> str:
    confirmation_guidance = ""
    plain = _plain_text(original_text)
    asks_for_confirmation = bool(
        re.search(r"(?:ne|certo|correto|nao e|right)\s*[?!.]*$", plain)
        or re.match(r"^(?:entao|ou seja)\b", plain)
    )
    if asks_for_confirmation:
        confirmation_guidance = (
            "\n- a mensagem pede confirmação. Responda à confirmação já no "
            "começo. Se a ideia estiver correta, ainda que apenas no sentido "
            "pretendido pelo cliente, a resposta DEVE começar com "
            "\"Sim — nesse sentido, ...\" e só depois trazer a ressalva. Uma "
            "formulação como \"não necessariamente X, mas Y\" é uma confirmação "
            "parcial: obrigatoriamente reordene para \"Sim — nesse sentido, Y. "
            "A ressalva é que não necessariamente X\". "
            "Use \"Não exatamente\" somente se a ideia central estiver errada "
            "ou puder induzir a uma conclusão insegura; não comece apenas "
            "repetindo a explicação."
        )
    return (
        "Plano deste turno (instrução do sistema):\n"
        f"- profundidade: {decision.answer_depth}\n"
        f"- objetivo essencial: {decision.core_goal}\n"
        f"- calor da voz: {decision.warmth}\n"
        f"- nível de terminologia: {decision.terminology_level}\n"
        "- responda a todos os pedidos e perguntas da mensagem atual; não "
        "abandone o último ponto para desenvolver demais o primeiro.\n"
        "- controle o tamanho pela redação: reduza detalhes antes de cortar uma "
        "frase ou deixar uma pergunta sem resposta.\n"
        "- escreva somente a resposta essencial; não acrescente pergunta final "
        "nem ofereça próximos tópicos."
        f"{confirmation_guidance}"
    )


def render_followup(
    mode: str,
    topics: tuple[str, ...],
    language: str,
) -> str:
    if mode == "none" or len(topics) < 2:
        return ""
    labels = _TOPIC_LABELS.get(language) or _TOPIC_LABELS["en"]
    rendered = [labels[topic] for topic in topics if topic in labels]
    if len(rendered) < 2:
        return ""
    if language == "pt":
        joined = (
            f"{rendered[0]} ou {rendered[1]}"
            if len(rendered) == 2
            else f"{rendered[0]}, {rendered[1]} ou {rendered[2]}"
        )
        if mode == "clarify_choice":
            return f"Qual você prefere primeiro: {joined}?"
        return f"Quer entender primeiro {joined}?"
    joined = (
        f"{rendered[0]} or {rendered[1]}"
        if len(rendered) == 2
        else f"{rendered[0]}, {rendered[1]}, or {rendered[2]}"
    )
    if mode == "clarify_choice":
        return f"Which would you like first: {joined}?"
    return f"Would you like to start with {joined}?"


def make_confirmation_direct(
    original_text: str,
    answer: str,
    language: str,
) -> str:
    """Garante que confirmações parciais reconheçam primeiro o sentido válido."""
    plain_question = _plain_text(original_text)
    asks_for_confirmation = bool(
        re.search(
            r"(?:ne|certo|correto|nao e|right)\s*[?!.]*$",
            plain_question,
        )
        or re.match(r"^(?:entao|ou seja)\b", plain_question)
    )
    if not asks_for_confirmation:
        return answer

    plain_answer = _plain_text(answer)
    direct_openings = (
        ("sim", "nao", "exato", "isso mesmo")
        if language == "pt"
        else ("yes", "no", "exactly", "not exactly")
    )
    if plain_answer.startswith(direct_openings):
        return answer

    # Neste conceito, “mais profunda” costuma significar “além da superfície
    # visível da planta”, não penetração física mais funda no solo. A frase
    # reconhece esse sentido sem transformar a nuance em uma promessa técnica.
    if (
        language == "pt"
        and "profund" in plain_question
        and any(
            term in plain_question
            for term in ("capina eletrica", "electroherb", "tradicional")
        )
    ):
        return (
            "Sim — no sentido de atuar além da superfície da planta. "
            f"{answer.lstrip()}"
        )

    if language == "pt" and "nao necessariamente" in plain_answer and " mas " in plain_answer:
        return f"Sim — nesse sentido. {answer.lstrip()}"
    if language == "en" and "not necessarily" in plain_answer and " but " in plain_answer:
        return f"Yes — in that sense. {answer.lstrip()}"
    return answer


def reply_without_retrieval(
    decision: RoutingDecision,
    original_text: str = "",
    history: list[dict[str, object]] | None = None,
) -> str:
    """Resolve atos conversacionais que não precisam consultar a base vetorial."""
    if decision.act == "social_only":
        return reply_to_social(original_text, decision.language)
    if decision.act == "company_confirmation":
        prefix = _social_prefix(original_text, decision.language)
        if decision.language == "pt":
            return f"{prefix} Sim, você está falando com a Zasso."
        return f"{prefix} Yes, you're speaking with Zasso."
    if decision.act == "positive_reaction":
        if history and ambiguous_acceptance(original_text, history):
            return "Claro!" if decision.language == "pt" else "Sure!"
        level = decision.reaction_intensity if decision.reaction_intensity != "none" else "medium"
        return random.choice(_POSITIVE_REACTION_POOLS[level])
    if decision.act == "neutral_acknowledgment":
        return random.choice(_NEUTRAL_REACTION_POOL)
    if decision.act == "negative_reaction":
        level = decision.reaction_intensity if decision.reaction_intensity != "none" else "medium"
        return random.choice(_NEGATIVE_REACTION_POOLS[level])
    if decision.act == "handoff_request":
        return pick_handoff_reply(decision.language)
    if decision.act == "unsafe_or_extraction":
        return _pick("extraction", decision.language)
    return random.choice(_OFF_TOPIC_POOL)


def composition_prefix(
    decision: RoutingDecision,
    original_text: str = "",
) -> str:
    """Preâmbulo curto para mensagens compostas, sem substituir a resposta informativa."""
    parts: list[str] = []
    if decision.has_greeting:
        parts.append(_social_prefix(original_text, decision.language))
    plain = _plain_text(original_text)
    asks_for_clearer_explanation = any(
        marker in plain
        for marker in (
            "nao entendi",
            "nao ficou claro",
            "nao consegui entender",
            "pode explicar melhor",
            "explica melhor",
            "fiquei confuso",
            "fiquei confusa",
            "did not understand",
            "didnt understand",
            "not clear",
            "explain it better",
            "explain again",
        )
    )
    if asks_for_clearer_explanation:
        parts.append(
            "Tranquilo, te explico melhor!"
            if decision.language == "pt"
            else "No problem — let me explain it more clearly!"
        )
    elif decision.has_reaction:
        if decision.sentiment == "positive":
            parts.append("Legal!")
        elif decision.sentiment == "negative":
            parts.append("Entendo.")
    return " ".join(parts)

# Mensagem separada de ENGAJAMENTO, enviada depois da resposta normal do RAG.
HANDOFF_ENGAGEMENT_POOL: dict[str, list[str]] = {
    "pt": [
        "Aliás, você já trouxe pontos bem específicos, o que ajuda bastante. Deixei esse contexto organizado para nossa equipe; assim, se alguém do time continuar com você, não vai precisar repetir tudo. E podemos seguir conversando por aqui normalmente 😊",
        "Suas perguntas já deram uma visão bem boa do que você procura. Deixei esse contexto registrado para nossa equipe facilitar a continuidade, sem interromper nossa conversa por aqui.",
        "Aproveitando: deixei os pontos que você trouxe organizados para nossa equipe. Se o atendimento seguir com alguém do time, a pessoa já recebe o contexto — e você pode continuar me perguntando por aqui.",
    ],
}


def is_human_handoff_request(text: str) -> bool:
    """Checado ANTES do route() genérico — precisa disparar mark_handoff (prioridade
    2) no handler, então o handler precisa saber que foi ESSA categoria, não só
    receber texto pronto."""
    return bool(_HUMAN_HANDOFF_PATTERN.search(text))


def pick_handoff_reply(language: str = _DEFAULT_LANG) -> str:
    """Resposta completa pro pedido explícito de humano (prioridade 2)."""
    return _pick("handoff_explicit", language)


def pick_generation_handoff_reply(language: str = _DEFAULT_LANG) -> str:
    """Encaminhamento honesto após esgotar as gerações automáticas."""
    if language == "en":
        return (
            "I want to confirm this accurately. I've recorded your question "
            "and the conversation context so our team can continue without "
            "asking you to repeat everything."
        )
    return (
        "Quero confirmar esse ponto com precisão. Registrei sua dúvida e o "
        "contexto da conversa para nossa equipe continuar com você sem que "
        "precise explicar tudo de novo."
    )


def pick_engagement_note(language: str = _DEFAULT_LANG) -> str:
    """Sorteia o segundo balão de engajamento no idioma da conversa."""
    pool = HANDOFF_ENGAGEMENT_POOL.get(language) or HANDOFF_ENGAGEMENT_POOL[_DEFAULT_LANG]
    return random.choice(pool)


def _pick(category: str, language: str) -> str:
    """Sorteia uma variante da categoria no idioma pedido (cai no PT-BR se o
    idioma ainda não tiver pool)."""
    pools = _REPLY_POOLS.get(language) or _REPLY_POOLS[_DEFAULT_LANG]
    return random.choice(pools[category])


def route(text: str, language: str = _DEFAULT_LANG) -> str | None:
    """Devolve resposta fixa pra um caso óbvio, ou None se deve seguir pro RAG normal.

    `language` já existe pro caminho multilíngue; no estágio 1 é sempre PT-BR
    (o router roda antes da detecção de idioma — ver debt.md sobre essa ruga)."""
    if _EXTRACTION_PATTERN.search(text):
        return _pick("extraction", language)
    if _PROFANITY_PATTERN.search(text):
        return _pick("profanity", language)
    if _is_greeting_or_smalltalk(text):
        return reply_to_social(text, language)
    if _is_pure_acknowledgment(text):
        return _pick("acknowledgment", language)
    return None


def route_guardrail(text: str, language: str = _DEFAULT_LANG) -> str | None:
    """Atalhos determinísticos de segurança/tom; não tenta interpretar conversa."""
    if _EXTRACTION_PATTERN.search(text):
        return _pick("extraction", language)
    if _PROFANITY_PATTERN.search(text):
        return _pick("profanity", language)
    return None
