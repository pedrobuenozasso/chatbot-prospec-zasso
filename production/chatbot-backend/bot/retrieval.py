"""Busca vetorial no Postgres/pgvector — a base de conhecimento povoada pelo ingestion-worker."""
from dataclasses import dataclass
from uuid import UUID

from bot import db
from bot.config import Settings
from bot.embeddings import embed


@dataclass(frozen=True)
class RetrievedChunk:
    chunk_id: UUID
    content_hash: str
    faq_id: str
    question: str
    section: str
    visibility: str
    content: str
    distance: float

def search_chunks(question: str, settings: Settings, limit: int = 5) -> list[RetrievedChunk]:
    vector = embed(question, settings)

    with db.connection(settings) as conn:
        rows = conn.execute(
            """
            SELECT c.id, c.content_hash, d.faq_id, d.question,
                   c.section, c.visibility, c.content,
                   (c.embedding <=> %s::vector) AS distance
            FROM chunks c
            JOIN documents d ON d.id = c.document_id
            -- Defesa em profundidade: a resposta ao cliente jamais pode
            -- recuperar chunks internos, ainda que alguém os tenha indexado.
            WHERE c.visibility IN ('public', 'public_suggested')
            ORDER BY distance ASC
            LIMIT %s
            """,
            (vector, limit),
        ).fetchall()

    return [
        RetrievedChunk(
            chunk_id=chunk_id,
            content_hash=content_hash,
            faq_id=faq_id,
            question=faq_question,
            section=section,
            visibility=visibility,
            content=content,
            distance=distance,
        )
        for (
            chunk_id,
            content_hash,
            faq_id,
            faq_question,
            section,
            visibility,
            content,
            distance,
        ) in rows
    ]
