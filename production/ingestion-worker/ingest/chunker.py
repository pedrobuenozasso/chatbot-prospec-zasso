"""
Transforma um FaqDocument (já parseado) em chunks prontos para embedding.

Regra combinada com o dono do projeto: cada seção do Markdown vira 1 chunk,
com uma visibilidade que decide se ela pode aparecer literalmente na resposta
ao cliente (public), se é uma frase pronta reaproveitável (public_suggested),
ou se serve só de orientação/guardrail para o LLM e nunca deve ser citada
(internal) — cobre Evidence and Context, Caveats e Internal Notes.
"""
import hashlib
import logging
from dataclasses import dataclass

from ingest.parser import FaqDocument

logger = logging.getLogger(__name__)

SECTION_VISIBILITY: dict[str, str] = {
    "Short Answer": "public",
    "Detailed Answer": "public",
    "What This Means for Customers": "public",
    "Safe Sales Wording": "public_suggested",
    "Evidence and Context": "internal",
    "Caveats": "internal",
    "Internal Notes": "internal",
}


@dataclass(frozen=True)
class Chunk:
    section: str
    visibility: str
    content: str
    content_hash: str
    embedding_text: str  # texto realmente enviado ao modelo de embedding


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def build_chunks(doc: FaqDocument) -> list[Chunk]:
    chunks: list[Chunk] = []
    for section, content in doc.sections.items():
        visibility = SECTION_VISIBILITY.get(section)
        if visibility is None:
            logger.warning("%s: seção desconhecida '%s' ignorada.", doc.source_file, section)
            continue
        if not content.strip():
            continue
        # Prefixar com a pergunta ajuda a busca por similaridade: o usuário
        # pergunta em linguagem natural, e a pergunta canônica do FAQ costuma
        # se parecer mais com isso do que o corpo técnico da resposta sozinho.
        embedding_text = f"{doc.question}\n\n{content}" if doc.question else content
        chunks.append(Chunk(
            section=section,
            visibility=visibility,
            content=content,
            content_hash=_sha256(content),
            embedding_text=embedding_text,
        ))
    return chunks
