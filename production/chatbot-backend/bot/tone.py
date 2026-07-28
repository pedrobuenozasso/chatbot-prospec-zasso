"""Regras determinísticas aplicadas à resposta imediatamente antes do envio."""

import re

ALLOWED_EMOJIS = frozenset("✨🚜⚡💡😊🌱")
MAX_EMOJIS_PER_MESSAGE = 2

_EMOJI_RANGES = (
    (0x1F1E6, 0x1F1FF),  # bandeiras
    (0x1F300, 0x1FAFF),  # pictogramas, rostos, objetos e símbolos recentes
    (0x2600, 0x27BF),  # símbolos diversos e dingbats
)
_EMOJI_JOINERS = {0x200D, 0x20E3, 0xFE0E, 0xFE0F}


def _is_emoji_codepoint(char: str) -> bool:
    codepoint = ord(char)
    return codepoint in _EMOJI_JOINERS or any(
        start <= codepoint <= end for start, end in _EMOJI_RANGES
    )


def sanitize_reply(text: str) -> str:
    """Mantém apenas a allowlist e no máximo dois emojis por mensagem."""
    kept: list[str] = []
    emoji_count = 0
    for char in text:
        if char in ALLOWED_EMOJIS:
            if emoji_count < MAX_EMOJIS_PER_MESSAGE:
                kept.append(char)
                emoji_count += 1
            continue
        if _is_emoji_codepoint(char):
            continue
        kept.append(char)

    sanitized = "".join(kept)
    # Normalizações de linguagem aprovadas para PT-BR. O prompt continua sendo a
    # primeira linha de controle; estas substituições impedem regressões visíveis.
    sanitized = re.sub(r"\bA Electroherb\b", "O Electroherb", sanitized)
    sanitized = re.sub(r"\ba Electroherb\b", "o Electroherb", sanitized)
    sanitized = re.sub(
        r"\bA tecnologia Electroherb,\s*a tecnologia de capina elétrica da Zasso,?",
        "O Electroherb, a tecnologia de capina elétrica da Zasso,",
        sanitized,
        flags=re.IGNORECASE,
    )

    def replace_pt_term(match: re.Match, replacement: str) -> str:
        return replacement.capitalize() if match.group(0)[0].isupper() else replacement

    for pattern in (
        r"\bvegetação indesejada\b",
        r"\bplantas indesejadas\b",
        r"\bplantas[- ]alvo\b",
    ):
        sanitized = re.sub(
            pattern,
            lambda match: replace_pt_term(match, "ervas daninhas"),
            sanitized,
            flags=re.IGNORECASE,
        )
    sanitized = re.sub(
        r"\bervas daninhas e ervas daninhas\b",
        "ervas daninhas",
        sanitized,
        flags=re.IGNORECASE,
    )
    sanitized = re.sub(r"[ \t]{2,}", " ", sanitized)
    sanitized = re.sub(r"[ \t]+([,.;:!?])", r"\1", sanitized)
    allowed_class = re.escape("".join(ALLOWED_EMOJIS))
    sanitized = re.sub(
        rf"([{allowed_class}](?:[ \t]*[{allowed_class}])*)([.!?])",
        r"\2 \1",
        sanitized,
    )
    sanitized = re.sub(r"[ \t]+([,.;:!?])", r"\1", sanitized)
    sanitized = re.sub(r"[ \t]+\n", "\n", sanitized)
    return sanitized.strip()


def adapt_reply_to_history(
    text: str,
    history: list[dict[str, object]],
) -> str:
    """Evita padrões mecânicos visíveis entre duas respostas consecutivas."""
    previous_assistant = next(
        (
            str(message.get("content") or "")
            for message in reversed(history)
            if message.get("role") == "assistant"
        ),
        "",
    )
    if not previous_assistant:
        return text

    # Um emoji é opcional; repetir o mesmo símbolo em toda resposta técnica
    # transforma a allowlist em assinatura automática.
    repeated_emojis = {
        emoji for emoji in ALLOWED_EMOJIS if emoji in previous_assistant
    }
    for emoji in repeated_emojis:
        text = text.replace(emoji, "")

    # A explicação completa do nome cabe na primeira menção da conversa. Depois,
    # o termo comum é mais natural e suficiente.
    if "electroherb" in previous_assistant.casefold():
        text = re.sub(
            r"\bO Electroherb,\s*a tecnologia de capina elétrica da Zasso,?",
            "A capina elétrica da Zasso",
            text,
        )
        text = re.sub(
            r"\bElectroherb,\s*a tecnologia de capina elétrica da Zasso,?",
            "a capina elétrica da Zasso",
            text,
        )

    return text
