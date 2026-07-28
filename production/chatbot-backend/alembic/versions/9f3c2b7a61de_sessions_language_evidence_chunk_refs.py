"""sessions, language evidence and normalized chunk references

Revision ID: 9f3c2b7a61de
Revises: 446189f00df8
Create Date: 2026-07-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "9f3c2b7a61de"
down_revision: Union[str, Sequence[str], None] = "446189f00df8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Estado persistente do idioma e sessão ativa.
    op.add_column(
        "conversations",
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
    )
    op.add_column(
        "conversations",
        sa.Column(
            "session_started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.add_column("conversations", sa.Column("language_candidate", sa.Text(), nullable=True))
    op.add_column(
        "conversations",
        sa.Column("language_evidence_count", sa.SmallInteger(), nullable=False, server_default="0"),
    )
    op.add_column(
        "conversations",
        sa.Column("language_locked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "conversations",
        sa.Column("language_switch_candidate", sa.Text(), nullable=True),
    )
    op.add_column(
        "conversations",
        sa.Column(
            "language_switch_evidence_count",
            sa.SmallInteger(),
            nullable=False,
            server_default="0",
        ),
    )
    op.create_check_constraint(
        "conversations_language_evidence_nonnegative",
        "conversations",
        "language_evidence_count >= 0 AND language_switch_evidence_count >= 0",
    )

    # Cada mensagem pertence a uma sessão. O histórico completo continua no chat,
    # mas a janela do LLM nunca cruza uma pausa longa.
    op.add_column(
        "conversation_messages",
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.execute(
        """
        UPDATE conversation_messages m
        SET session_id = c.session_id
        FROM conversations c
        WHERE c.chat_id = m.chat_id AND m.session_id IS NULL
        """
    )
    op.alter_column("conversation_messages", "session_id", nullable=False)
    op.create_index(
        "conversation_messages_session_recency_idx",
        "conversation_messages",
        ["chat_id", "session_id", sa.text("created_at DESC")],
    )
    op.add_column(
        "conversation_messages_archive",
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # Referências compactas aos chunks usados. Não há FK para chunks porque o
    # ingestion-worker recria IDs ao reingerir documentos; content_hash permite
    # reencontrar conteúdo idêntico quando o UUID mudar.
    op.create_table(
        "conversation_message_chunks",
        sa.Column(
            "message_id",
            sa.BigInteger(),
            sa.ForeignKey("conversation_messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("chunk_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content_hash", sa.Text(), nullable=False),
        sa.Column("rank", sa.SmallInteger(), nullable=False),
        sa.Column("distance", sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint("message_id", "rank"),
    )
    op.create_index(
        "conversation_message_chunks_chunk_idx",
        "conversation_message_chunks",
        ["chunk_id"],
    )
    op.create_table(
        "conversation_message_chunks_archive",
        sa.Column("message_id", sa.BigInteger(), nullable=False),
        sa.Column("chunk_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content_hash", sa.Text(), nullable=False),
        sa.Column("rank", sa.SmallInteger(), nullable=False),
        sa.Column("distance", sa.Float(), nullable=False),
        sa.Column(
            "archived_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("message_id", "rank"),
    )

    # Converte auditoria legada (JSON completo) quando houver mensagens antigas.
    op.execute(
        """
        INSERT INTO conversation_message_chunks
            (message_id, chunk_id, content_hash, rank, distance)
        SELECT
            m.id,
            matched.chunk_id,
            matched.content_hash,
            (entry.ordinality - 1)::smallint,
            COALESCE((entry.item ->> 'distance')::double precision, 0)
        FROM conversation_messages m
        CROSS JOIN LATERAL jsonb_array_elements(m.chunks_used)
            WITH ORDINALITY AS entry(item, ordinality)
        JOIN LATERAL (
            SELECT c.id AS chunk_id, c.content_hash
            FROM chunks c
            JOIN documents d ON d.id = c.document_id
            WHERE d.faq_id = entry.item ->> 'faq_id'
              AND c.section = entry.item ->> 'section'
            LIMIT 1
        ) AS matched ON true
        WHERE m.chunks_used IS NOT NULL
        ON CONFLICT DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_table("conversation_message_chunks_archive")
    op.drop_index(
        "conversation_message_chunks_chunk_idx",
        table_name="conversation_message_chunks",
    )
    op.drop_table("conversation_message_chunks")
    op.drop_column("conversation_messages_archive", "session_id")
    op.drop_index(
        "conversation_messages_session_recency_idx",
        table_name="conversation_messages",
    )
    op.drop_column("conversation_messages", "session_id")
    op.drop_constraint(
        "conversations_language_evidence_nonnegative",
        "conversations",
        type_="check",
    )
    op.drop_column("conversations", "language_switch_evidence_count")
    op.drop_column("conversations", "language_switch_candidate")
    op.drop_column("conversations", "language_locked_at")
    op.drop_column("conversations", "language_evidence_count")
    op.drop_column("conversations", "language_candidate")
    op.drop_column("conversations", "session_started_at")
    op.drop_column("conversations", "session_id")
