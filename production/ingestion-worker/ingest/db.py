"""Acesso ao Postgres (tabelas documents/chunks definidas em schema.sql)."""
import psycopg
from pgvector.psycopg import register_vector

from ingest.chunker import Chunk
from ingest.config import Settings
from ingest.parser import FaqDocument


def connect(settings: Settings) -> psycopg.Connection:
    conn = psycopg.connect(settings.database_url)
    register_vector(conn)
    return conn


def is_document_up_to_date(conn: psycopg.Connection, source_file: str, file_hash: str) -> bool:
    """
    True só se o documento já existe COM o mesmo hash E já tem pelo menos 1 chunk.
    A checagem de chunk existir importa porque a tabela chunks pode ter sido
    recriada (ex: troca de modelo/dimensão de embedding) sem que documents mude —
    nesse caso o hash bate, mas não há nada de fato ingerido, e reprocessar é
    necessário mesmo sem --force.
    """
    row = conn.execute(
        """
        SELECT d.file_hash = %s AND EXISTS (SELECT 1 FROM chunks c WHERE c.document_id = d.id)
        FROM documents d WHERE d.source_file = %s
        """,
        (file_hash, source_file),
    ).fetchone()
    return bool(row and row[0])


def upsert_document(conn: psycopg.Connection, doc: FaqDocument) -> str:
    row = conn.execute(
        """
        INSERT INTO documents (source_file, faq_id, question, status, audience, evidence_level, file_hash)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (source_file) DO UPDATE SET
            faq_id = EXCLUDED.faq_id,
            question = EXCLUDED.question,
            status = EXCLUDED.status,
            audience = EXCLUDED.audience,
            evidence_level = EXCLUDED.evidence_level,
            file_hash = EXCLUDED.file_hash,
            ingested_at = now()
        RETURNING id
        """,
        (doc.source_file, doc.faq_id, doc.question, doc.status, doc.audience, doc.evidence_level, doc.file_hash),
    ).fetchone()
    return row[0]


def get_existing_chunk_embeddings(conn: psycopg.Connection, document_id: str) -> dict[str, list[float]]:
    """content_hash -> embedding já salvos para este documento (evita reprocessar sem mudança)."""
    rows = conn.execute(
        "SELECT content_hash, embedding FROM chunks WHERE document_id = %s", (document_id,)
    ).fetchall()
    return {content_hash: embedding for content_hash, embedding in rows}


def replace_chunks(conn: psycopg.Connection, document_id: str, chunks: list[tuple[Chunk, list[float]]]) -> None:
    """Substitui todos os chunks do documento pelos novos (simples e correto para este volume)."""
    conn.execute("DELETE FROM chunks WHERE document_id = %s", (document_id,))
    conn.cursor().executemany(
        """
        INSERT INTO chunks (document_id, section, visibility, content, content_hash, embedding)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        [
            (document_id, chunk.section, chunk.visibility, chunk.content, chunk.content_hash, embedding)
            for chunk, embedding in chunks
        ],
    )
